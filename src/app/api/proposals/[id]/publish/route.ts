export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

// POST /api/proposals/:id/publish — 提案書をWeb公開
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const proposal = await db.proposal.findUnique({ where: { id } });
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 既に公開済みならslugを返す
  if (proposal.isPublished && proposal.slug) {
    return NextResponse.json({ slug: proposal.slug, alreadyPublished: true });
  }

  // リクエストからカスタムslugを取得
  let slug: string;
  try {
    const body = await req.json().catch(() => ({}));
    slug = body.slug?.trim() || "";
  } catch {
    slug = "";
  }

  // slugのバリデーション
  if (slug) {
    // 英数字・ハイフン・アンダースコアのみ
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "URLには半角英数字・ハイフン・アンダースコアのみ使用できます" },
        { status: 400 }
      );
    }
    // 既存slugとの重複チェック
    const existing = await db.proposal.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "このURLは既に使用されています。別のURLを指定してください" },
        { status: 409 }
      );
    }
  } else {
    // カスタムslugがなければランダム生成
    slug = randomBytes(4).toString("hex");
  }

  const updated = await db.proposal.update({
    where: { id },
    data: {
      slug,
      isPublished: true,
      publishedAt: new Date(),
      title: proposal.title || `${proposal.companyName} ご提案書`,
    },
  });

  return NextResponse.json({ slug: updated.slug });
}

// DELETE /api/proposals/:id/publish — 公開を取り消し
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await db.proposal.update({
    where: { id },
    data: { isPublished: false },
  });

  return NextResponse.json({ ok: true });
}
