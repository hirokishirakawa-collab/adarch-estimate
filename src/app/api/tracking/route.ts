export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { sendChatMessage } from "@/lib/google-chat";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** シンプルなIP別レートリミット（公開エンドポイント用） */
const ipCounts = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();
function checkPublicRateLimit(ip: string): boolean {
  const now = Date.now();
  // 60秒ごとに期限切れエントリを削除（メモリリーク防止）
  if (now - lastCleanup > 60_000) {
    for (const [key, val] of ipCounts) {
      if (val.resetAt < now) ipCounts.delete(key);
    }
    lastCleanup = now;
  }
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= 30; // 30 req/min per IP
}

// POST /api/tracking — 閲覧イベント記録
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkPublicRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://adarch-estimate-production.up.railway.app";
      const previewUrl = `${appUrl}/dashboard/proposals?preview=${proposalId}`;
      sendChatMessage(
        process.env.DEAL_CHAT_SPACE_ID ?? "AAQAp6XvXqE",
        `📄 提案書が閲覧されました\n` +
        `企業名: ${proposal.companyName}\n` +
        `作成者: ${author}\n` +
        `日時: ${now}\n` +
        `プレビュー: ${previewUrl}`
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
