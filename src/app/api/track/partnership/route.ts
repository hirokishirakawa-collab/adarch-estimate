import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { partnershipTrackSign, DOC_PDF_URL, BOOKING_URL } from "@/lib/partnership-track";

export const runtime = "nodejs";

// ----------------------------------------------------------------
// GET /api/track/partnership?k=doc|booking&e=<email>&s=<hmac>
// 加盟の資料請求 自動返信メール内リンクのクリック計測。
// 記録してから本来のURLへ302リダイレクトする。認証なしの公開エンドポイントのため、
// HMAC署名（AUTH_SECRET）で正規のメール由来クリックのみ記録する。
// 署名が不正でもリダイレクトは必ず行う（相手の体験を壊さない）。
// ----------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("k") ?? "";
  const email = (searchParams.get("e") ?? "").trim();
  const sig = searchParams.get("s") ?? "";

  const dest = kind === "booking" ? BOOKING_URL : DOC_PDF_URL;

  try {
    if ((kind === "doc" || kind === "booking") && email && sig) {
      const expected = partnershipTrackSign(kind, email);
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      const valid = a.length === b.length && timingSafeEqual(a, b);

      if (valid) {
        const lead = await db.franchiseLead.findFirst({
          where: { email, source: { in: ["LP_FORM", "WINDOW"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, docViewedAt: true, bookingClickedAt: true },
        });
        if (lead) {
          await db.franchiseLead.update({
            where: { id: lead.id },
            data:
              kind === "doc"
                ? { docViewedAt: lead.docViewedAt ?? new Date(), docViewCount: { increment: 1 } }
                : {
                    bookingClickedAt: lead.bookingClickedAt ?? new Date(),
                    bookingClickCount: { increment: 1 },
                  },
          });
        }
      }
    }
  } catch (e) {
    // 計測失敗でもリダイレクトは止めない
    console.error("[track/partnership] error:", e instanceof Error ? e.message : e);
  }

  return NextResponse.redirect(dest, 302);
}
