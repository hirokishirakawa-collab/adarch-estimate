// ==============================================================
// POST /api/portfolio/ai-search — 実績AI検索
// ユーザーの自然言語クエリからDBを検索し、提案文を生成
// ==============================================================

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query } = (await req.json()) as { query: string };
  if (!query?.trim()) {
    return NextResponse.json({ error: "検索クエリが必要です" }, { status: 400 });
  }

  // 1. DB から全フォルダ構成を取得（ファイル名・パスで判断するため）
  const allItems = await db.portfolioItem.findMany({
    orderBy: [{ depth: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      path: true,
      itemType: true,
      mimeType: true,
      sizeMb: true,
      driveUrl: true,
      depth: true,
      parentName: true,
      lastUpdated: true,
    },
  });

  if (allItems.length === 0) {
    return NextResponse.json({
      answer: "実績データがまだ同期されていません。",
      items: [],
    });
  }

  // 2. フォルダ構成をテキスト化してAIに渡す
  const folderTree = allItems
    .map((item) => {
      const indent = "  ".repeat(item.depth);
      const typeLabel = item.itemType === "folder" ? "[フォルダ]" : `[${item.mimeType}]`;
      const size = item.itemType === "file" && item.sizeMb > 0 ? ` (${item.sizeMb}MB)` : "";
      return `${indent}${typeLabel} ${item.name}${size}`;
    })
    .join("\n");

  // 3. AIに問い合わせ
  const systemPrompt = `あなたはアドアーチグループの営業支援AIです。
Google Drive上の実績フォルダ（動画制作・広告制作の過去実績）の構成データをもとに、
営業担当者がクライアントに実績を紹介する際に最適な素材を提案してください。

以下が実績フォルダの構成です：

${folderTree}

ルール:
- ユーザーの質問に対して、関連する実績フォルダ・ファイルを選んで紹介してください
- フォルダ名やファイル名から業界・クライアント・制作内容を推測してください
- 回答は営業パーソンがクライアントに送れるような丁寧な提案文形式にしてください
- 該当する実績が見つからない場合は正直にその旨を伝え、近いジャンルがあれば代替提案してください
- 必ず日本語で回答してください
- 回答の最後に「関連実績ファイル」として、該当するファイル名を箇条書きでリストしてください（完全一致のファイル名で）`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: query }],
    system: systemPrompt,
  });

  const answer =
    response.content[0].type === "text" ? response.content[0].text : "";

  // 4. AI回答内に含まれるファイル名でマッチするアイテムを抽出
  const matchedItems = allItems.filter(
    (item) => answer.includes(item.name) && item.itemType === "file"
  );

  // フォルダも含める（親フォルダ名がマッチ）
  const matchedFolders = allItems.filter(
    (item) => answer.includes(item.name) && item.itemType === "folder"
  );

  return NextResponse.json({
    answer,
    items: [...matchedFolders, ...matchedItems].map((item) => ({
      id: item.id,
      name: item.name,
      path: item.path,
      itemType: item.itemType,
      mimeType: item.mimeType,
      driveUrl: item.driveUrl,
    })),
  });
}
