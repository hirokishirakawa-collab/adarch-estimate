import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ---------------------------------------------------------------
// 営業フォームのマイサンプル（自作営業文）— ユーザーアカウントに紐づくDB保存
//   GET : ログインユーザーのサンプル一覧
//   PUT : 一覧をまるごと同期（追加・更新・削除）。body: { samples: [{id?, name, text}] }
// ---------------------------------------------------------------

async function getUser(email: string) {
  return db.user.findUnique({ where: { email } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const samples = await db.outreachSample.findMany({
    where: { userId: user.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, text: true },
  });
  return NextResponse.json({ samples });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getUser(session.user.email);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let payload: { samples?: Array<{ id?: string; name?: string; text?: string }> };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incoming = Array.isArray(payload.samples) ? payload.samples : [];
  // 上限（暴走防止）
  const items = incoming.slice(0, 100).map((s, i) => ({
    id: typeof s.id === "string" && s.id ? s.id : undefined,
    name: (typeof s.name === "string" ? s.name : "").slice(0, 200),
    text: (typeof s.text === "string" ? s.text : "").slice(0, 8000),
    sortOrder: i,
  }));

  // 既存（このユーザーのもの）
  const existing = await db.outreachSample.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));
  const keepIds = new Set<string>();

  const ops = [];
  for (const it of items) {
    if (it.id && existingIds.has(it.id)) {
      // 自分の既存サンプルのみ更新（ID所有権を担保）
      keepIds.add(it.id);
      ops.push(
        db.outreachSample.update({
          where: { id: it.id },
          data: { name: it.name, text: it.text, sortOrder: it.sortOrder },
        }),
      );
    } else {
      // 新規（クライアント提供IDがあれば踏襲、なければDB採番）
      if (it.id) keepIds.add(it.id);
      ops.push(
        db.outreachSample.create({
          data: { id: it.id, userId: user.id, name: it.name, text: it.text, sortOrder: it.sortOrder },
        }),
      );
    }
  }
  // 一覧から消えたものを削除（このユーザーの範囲のみ）
  const toDelete = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
  if (toDelete.length) {
    ops.unshift(db.outreachSample.deleteMany({ where: { userId: user.id, id: { in: toDelete } } }));
  }

  await db.$transaction(ops);

  const samples = await db.outreachSample.findMany({
    where: { userId: user.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, text: true },
  });
  return NextResponse.json({ samples });
}
