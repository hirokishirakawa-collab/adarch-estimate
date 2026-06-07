"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

// ---------------------------------------------------------------
// POST /api/leads/import
// CSVファイルからリードを一括インポート
// ---------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email ?? "";
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const staffName = user.name ?? email;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "CSVファイルが選択されていません" },
        { status: 400 }
      );
    }

    // ファイルをバッファとして読み込み
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // エンコーディング判定: UTF-8 BOM → UTF-8、それ以外は Shift-JIS を試す
    let csvText: string;
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      // UTF-8 BOM
      csvText = buffer.subarray(3).toString("utf-8");
    } else {
      // UTF-8 として試す → デコードエラーの特徴的なパターンがあれば Shift-JIS
      const utf8Text = buffer.toString("utf-8");
      // Shift-JIS でよく使われる日本語がUTF-8としてデコードされると文字化けする
      // 簡易判定: ヘッダーの「会社名」が含まれているかチェック
      if (utf8Text.includes("会社名") || utf8Text.includes("住所")) {
        csvText = utf8Text;
      } else {
        // Shift-JIS としてデコード
        csvText = iconv.decode(buffer, "Shift_JIS");
      }
    }

    // CSV パース
    let records: Record<string, string>[];
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (parseError) {
      const msg =
        parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json(
        { imported: 0, skipped: 0, errors: [`CSVパースエラー: ${msg}`] },
        { status: 400 }
      );
    }

    // カラムマッピング
    const COLUMN_MAP: Record<string, string> = {
      会社名: "name",
      住所: "address",
      電話番号: "phone",
      WebサイトURL: "websiteUrl",
      業種: "industry",
      エリア: "area",
      メモ: "memo",
      担当者名: "representativeName",
    };

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // ヘッダー行 + 0-indexed

      // カラムマッピングを適用
      const mapped: Record<string, string> = {};
      for (const [jpKey, enKey] of Object.entries(COLUMN_MAP)) {
        const value = row[jpKey]?.trim();
        if (value) {
          mapped[enKey] = value;
        }
      }

      // 必須チェック: 会社名
      if (!mapped.name) {
        errors.push(`${rowNum}行目: 会社名が空です`);
        continue;
      }

      // 重複チェック (name + address)
      const address = mapped.address || null;
      try {
        const existing = await db.lead.findUnique({
          where: {
            name_address: {
              name: mapped.name,
              address: address ?? "",
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // リード作成
        const created = await db.lead.create({
          data: {
            name: mapped.name,
            address,
            phone: mapped.phone || null,
            websiteUrl: mapped.websiteUrl || null,
            industry: mapped.industry || null,
            area: mapped.area || null,
            memo: mapped.memo || null,
            representativeName: mapped.representativeName || null,
            source: "CSV_IMPORT",
            status: "UNTOUCHED",
            createdById: user.id,
            // 取り込んだ代表を担当として自動反映（検索保存と同じ挙動に揃える）
            assigneeId: user.id,
          },
        });

        // ログ記録
        await db.leadLog.create({
          data: {
            leadId: created.id,
            action: "CREATED",
            detail: "CSVインポートから作成",
            staffName,
          },
        });

        imported++;
      } catch (dbError) {
        const msg =
          dbError instanceof Error ? dbError.message : String(dbError);
        errors.push(`${rowNum}行目(${mapped.name}): ${msg}`);
      }
    }

    return NextResponse.json({ imported, skipped, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[leads/import] Error:", msg, e);
    return NextResponse.json(
      { imported: 0, skipped: 0, errors: [`サーバーエラー: ${msg}`] },
      { status: 500 }
    );
  }
}
