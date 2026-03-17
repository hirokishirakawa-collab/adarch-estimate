export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { notifyCeo } from "@/lib/google-chat";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

// POST /api/tracking — 閲覧イベント記録
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposalId, type, duration, scrollDepth } = body;

    if (!proposalId || !type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 提案書の存在・公開状態を確認
    const proposal = await db.proposal.findUnique({
      where: { id: proposalId },
      select: { isPublished: true, companyName: true, slug: true, user: { select: { name: true, email: true } } },
    });

    if (!proposal?.isPublished) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const hashedIp = hashIp(ip);
    const userAgent = req.headers.get("user-agent") || undefined;
    const referrer = req.headers.get("referer") || undefined;

    if (type === "pageview") {
      // 新規閲覧レコード作成
      const view = await db.proposalView.create({
        data: {
          proposalId,
          viewerIp: hashedIp,
          userAgent,
          referrer,
        },
      });

      // Google Chat通知（非同期、エラーでもレスポンスに影響させない）
      const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      const author = proposal.user?.name || proposal.user?.email || "不明";
      notifyCeo(
        `📄 提案書が閲覧されました\n` +
        `企業名: ${proposal.companyName}\n` +
        `作成者: ${author}\n` +
        `日時: ${now}\n` +
        `リファラー: ${referrer || "直接アクセス"}`
      ).catch(() => {});

      return NextResponse.json({ viewId: view.id });
    }

    if (type === "update" && body.viewId) {
      // 既存レコードの滞在時間・スクロール深度を更新
      await db.proposalView.update({
        where: { id: body.viewId },
        data: {
          duration: duration ?? undefined,
          scrollDepth: scrollDepth ?? undefined,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
