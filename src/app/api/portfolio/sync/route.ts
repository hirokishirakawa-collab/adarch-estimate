// ==============================================================
// POST /api/portfolio/sync — Drive実績フォルダ同期
// GAS定期トリガーからの呼び出し用
// ==============================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const API_KEY = process.env.PORTFOLIO_SYNC_API_KEY;

export async function POST(req: NextRequest) {
  // API Key 認証
  if (!API_KEY) {
    console.error("[portfolio-sync] PORTFOLIO_SYNC_API_KEY is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const provided = req.headers.get("x-api-key");
  if (!provided || provided !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { items } = body as {
      items: Array<{
        driveFileId: string;
        itemType: string;
        name: string;
        path: string;
        mimeType: string;
        depth: number;
        sizeMb: number;
        driveUrl: string;
        parentName: string | null;
        lastUpdated: string;
      }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    // トランザクションで全件洗い替え（delete + createMany）
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.portfolioItem.deleteMany();
      // createMany は batch で高速
      await tx.portfolioItem.createMany({
        data: items.map((item) => ({
          driveFileId: item.driveFileId,
          itemType: item.itemType,
          name: item.name,
          path: item.path,
          mimeType: item.mimeType,
          depth: item.depth,
          sizeMb: item.sizeMb,
          driveUrl: item.driveUrl,
          parentName: item.parentName || null,
          lastUpdated: new Date(item.lastUpdated),
          syncedAt: now,
        })),
      });
    });

    console.log(`[portfolio-sync] Synced ${items.length} items`);
    return NextResponse.json({ ok: true, count: items.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[portfolio-sync] Error:", msg);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
