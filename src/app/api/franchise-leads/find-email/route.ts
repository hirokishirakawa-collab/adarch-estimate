import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findEmailFromWebsite } from "@/lib/leads/find-email";
import { resolveFranchiseAccess } from "@/lib/franchise-leads/access";

export const runtime = "nodejs";
export const maxDuration = 30;

// ----------------------------------------------------------------
// POST /api/franchise-leads/find-email
// 企業サイトからメールアドレスを自動抽出（ADMIN限定）
// id があれば FranchiseLead.email に保存する
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const access = await resolveFranchiseAccess();
  if (!access) {
    return NextResponse.json({ error: "この機能の利用権限がありません" }, { status: 403 });
  }

  let body: { id?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディのパースに失敗しました" }, { status: 400 });
  }

  let website = (body.website ?? "").trim();
  if (!website) {
    return NextResponse.json({ error: "WebサイトURLがありません" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(website)) website = `https://${website}`;

  // http(s) 以外は弾く（SSRF抑止）
  try {
    const u = new URL(website);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return NextResponse.json({ error: "対応していないURLです" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "URLの形式が不正です" }, { status: 400 });
  }

  try {
    const { email, candidates } = await findEmailFromWebsite(website);
    if (email && body.id) {
      // 非ADMINは自分が担当のリードにのみ保存できる
      if (!access.isAdmin) {
        const target = await db.franchiseLead.findUnique({
          where: { id: body.id },
          select: { ownerEmail: true },
        });
        if (target && target.ownerEmail === access.email) {
          await db.franchiseLead.update({ where: { id: body.id }, data: { email } });
        }
      } else {
        await db.franchiseLead.update({ where: { id: body.id }, data: { email } });
      }
    }
    return NextResponse.json({ email, candidates });
  } catch (err) {
    console.error("find-email error:", err);
    return NextResponse.json({ error: "メール抽出中にエラーが発生しました" }, { status: 500 });
  }
}
