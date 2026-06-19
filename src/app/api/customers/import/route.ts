"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@/types/roles";
import type { CustomerStatus, DealStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// POST /api/customers/import
// 既存顧客の一括登録。クライアントで貼り付け/CSV/URL補完したうえで
// 整形済みの行配列(rows[])を受け取り、まとめて顧客として作成する。
// 各顧客には初回商談(PROSPECTING)を自動作成し、そのまま①商談・提案
// タブで広告をクロスセルできる状態にする。
// ---------------------------------------------------------------

interface ImportRow {
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  prefecture?: string;
  address?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // ロール未設定は最小権限(USER)に倒す。MANAGER等を既定にしない（権限昇格の防止）
  const role = (session.user.role ?? "USER") as UserRole;
  const email = session.user.email ?? "";
  const staffName = session.user.name ?? email ?? "不明";
  const branchId = getMockBranchId(email, role);
  const effectiveBranchId = branchId ?? "branch_hq";

  let rows: ImportRow[];
  try {
    const body = (await req.json()) as { rows?: ImportRow[] };
    rows = Array.isArray(body.rows) ? body.rows : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "登録する顧客がありません" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json(
      { error: "一度に登録できるのは500件までです。分けて登録してください。" },
      { status: 400 }
    );
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const name = (rows[i].name ?? "").trim();

    if (!name) {
      errors.push(`${rowNum}行目: 会社名が空です`);
      continue;
    }
    if (name.length > 64) {
      errors.push(`${rowNum}行目(${name.slice(0, 12)}…): 会社名は64文字以内`);
      continue;
    }

    const phone = (rows[i].phone ?? "").trim() || null;

    try {
      // 重複チェック: 同一拠点内で会社名（＋電話があれば電話）が一致するもの
      const existing = await db.customer.findFirst({
        where: {
          branchId: effectiveBranchId,
          name,
          ...(phone ? { phone } : {}),
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await db.$transaction(async (tx) => {
        const c = await tx.customer.create({
          data: {
            name,
            contactName: (rows[i].contactName ?? "").trim() || null,
            phone,
            email: (rows[i].email ?? "").trim() || null,
            website: (rows[i].website ?? "").trim() || null,
            industry: (rows[i].industry ?? "").trim() || null,
            prefecture: (rows[i].prefecture ?? "").trim() || null,
            address: ((rows[i].address ?? "").trim() || null)?.slice(0, 256) ?? null,
            notes: ((rows[i].notes ?? "").trim() || null)?.slice(0, 1000) ?? null,
            source: "既存顧客の一括登録",
            status: "PROSPECT" as CustomerStatus,
            branchId: effectiveBranchId,
            staffName,
          },
        });

        // 初回商談を自動作成（そのまま商談・提案タブで広告提案へ進める）
        await tx.deal.create({
          data: {
            title: `${name} 初回商談`,
            status: "PROSPECTING" as DealStatus,
            amount: null,
            customerId: c.id,
            branchId: effectiveBranchId,
          },
        });
      });

      imported++;
    } catch (dbError) {
      // 生のDBエラーは外部に返さず、サーバー側ログにのみ記録する
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`[customers/import] row ${rowNum} (${name}) DB error:`, msg);
      errors.push(`${rowNum}行目(${name}): 登録に失敗しました`);
    }
  }

  if (imported > 0) {
    logAudit({
      action: "customers_bulk_imported",
      email,
      name: staffName,
      entity: "customer",
      entityId: effectiveBranchId,
      detail: `既存顧客の一括登録: ${imported}件（スキップ${skipped}件）`,
    });
  }

  return NextResponse.json({ imported, skipped, errors });
}
