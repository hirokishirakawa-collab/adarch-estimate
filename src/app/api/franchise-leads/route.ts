import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveFranchiseAccess } from "@/lib/franchise-leads/access";
import type { FranchiseLeadStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";

const FORBIDDEN = NextResponse.json(
  { error: "この機能の利用権限がありません" },
  { status: 403 }
);

// ----------------------------------------------------------------
// GET /api/franchise-leads
// 保存済みリード一覧取得（フィルタ: status, prefecture, priority）
// ADMIN=全件 / 開拓パートナー=自分が担当のリードのみ
// ----------------------------------------------------------------
export async function GET(req: NextRequest) {
  const access = await resolveFranchiseAccess();
  if (!access) return FORBIDDEN;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const prefecture = url.searchParams.get("prefecture");
  const priority = url.searchParams.get("priority");
  // ADMINのみ担当者で絞り込み可（パートナー画面では無視＝常に自分のみ）
  const owner = url.searchParams.get("owner");

  type WhereInput = {
    status?: FranchiseLeadStatus;
    prefecture?: string;
    priority?: string;
    ownerEmail?: string;
  };

  // ownerScope を先に展開（非ADMINは自分のリードに強制スコープ）
  const where: WhereInput = { ...access.ownerScope };
  if (status) where.status = status as FranchiseLeadStatus;
  if (prefecture) where.prefecture = prefecture;
  if (priority) where.priority = priority;
  if (access.isAdmin && owner) where.ownerEmail = owner;

  try {
    const leads = await db.franchiseLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ leads });
  } catch (err) {
    console.error("Franchise lead list error:", err);
    return NextResponse.json({ error: "リード一覧取得に失敗しました" }, { status: 500 });
  }
}

// ----------------------------------------------------------------
// POST /api/franchise-leads
// リード保存。保存者を担当者（ownerEmail/ownerName）として自動記録。
// ----------------------------------------------------------------
export async function POST(req: NextRequest) {
  const access = await resolveFranchiseAccess();
  if (!access) return FORBIDDEN;

  try {
    const body = await req.json();
    const leads = Array.isArray(body) ? body : [body];
    let savedCount = 0;

    for (const lead of leads) {
      const existing = await db.franchiseLead.findUnique({
        where: {
          companyName_address: {
            companyName: lead.companyName,
            address: lead.address ?? "",
          },
        },
      });

      if (existing) {
        // 既存リードへの再保存:
        // - 非ADMINは「自分が担当のリード」のみ更新可（他人/本部のリードは触れない）
        if (!access.isAdmin && existing.ownerEmail !== access.email) {
          continue;
        }
        // 既存: スコアのみ更新（担当者は変更しない）
        await db.franchiseLead.update({
          where: { id: existing.id },
          data: {
            scoreTotal: lead.scoreTotal ?? existing.scoreTotal,
            scoreBreakdown: lead.scoreBreakdown ?? existing.scoreBreakdown,
            scoreComment: lead.scoreComment ?? existing.scoreComment,
            rating: lead.rating ?? existing.rating,
            reviewCount: lead.reviewCount ?? existing.reviewCount,
            hasWebsite: lead.hasWebsite ?? existing.hasWebsite,
            hasYoutube: lead.hasYoutube ?? existing.hasYoutube,
            hasSns: lead.hasSns ?? existing.hasSns,
          },
        });
      } else {
        // 新規作成
        // 都道府県を住所から抽出
        const prefMatch = (lead.address ?? "").match(/(北海道|.{2,3}[都道府県])/);
        const prefecture = lead.prefecture ?? prefMatch?.[0] ?? null;

        await db.franchiseLead.create({
          data: {
            companyName: lead.companyName,
            address: lead.address ?? "",
            prefecture,
            phone: lead.phone || null,
            website: lead.website || null,
            googleMapsUrl: lead.googleMapsUrl || null,
            rating: lead.rating ?? null,
            reviewCount: lead.reviewCount ?? null,
            businessType: lead.businessType || null,
            scoreTotal: lead.scoreTotal ?? null,
            scoreBreakdown: lead.scoreBreakdown ?? null,
            scoreComment: lead.scoreComment || null,
            hasWebsite: lead.hasWebsite ?? false,
            hasYoutube: lead.hasYoutube ?? false,
            hasSns: lead.hasSns ?? false,
            employeeEstimate: lead.employeeEstimate || null,
            priority: lead.priority || null,
            // 拾った人を担当者として記録
            ownerEmail: access.email,
            ownerName: access.name,
          },
        });
        savedCount++;
      }
    }

    return NextResponse.json({ saved: savedCount });
  } catch (err) {
    console.error("Franchise lead save error:", err);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

// ----------------------------------------------------------------
// PUT /api/franchise-leads
// ステータス・メモ更新。非ADMINは自分が担当のリードのみ。
// ----------------------------------------------------------------
export async function PUT(req: NextRequest) {
  const access = await resolveFranchiseAccess();
  if (!access) return FORBIDDEN;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }

    // 所有権チェック（非ADMINは自分のリードのみ）
    const target = await db.franchiseLead.findUnique({
      where: { id },
      select: { id: true, ownerEmail: true },
    });
    if (!target) {
      return NextResponse.json({ error: "リードが見つかりません" }, { status: 404 });
    }
    if (!access.isAdmin && target.ownerEmail !== access.email) {
      return FORBIDDEN;
    }

    // 許可されたフィールドのみ更新（ownerEmail/ownerName は変更不可）
    const allowedFields = [
      "status", "priority", "notes", "contactedAt",
      "nextAction", "nextActionDate", "aiAdvice",
      "scoreTotal", "scoreBreakdown", "scoreComment",
      "email", "emailSubject", "emailBody", "emailDraftedAt",
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        data[key] = updates[key];
      }
    }

    // contactedAt が文字列で来た場合、Date に変換
    if (typeof data.contactedAt === "string") {
      data.contactedAt = new Date(data.contactedAt);
    }
    if (typeof data.nextActionDate === "string") {
      data.nextActionDate = new Date(data.nextActionDate);
    }
    if (typeof data.emailDraftedAt === "string") {
      data.emailDraftedAt = new Date(data.emailDraftedAt);
    }

    const updated = await db.franchiseLead.update({
      where: { id },
      data,
    });

    return NextResponse.json({ lead: updated });
  } catch (err) {
    console.error("Franchise lead update error:", err);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

// ----------------------------------------------------------------
// DELETE /api/franchise-leads
// 削除。非ADMINは自分が担当のリードのみ。
// ----------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const access = await resolveFranchiseAccess();
  if (!access) return FORBIDDEN;

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }

    // 所有権チェック（非ADMINは自分のリードのみ）
    const target = await db.franchiseLead.findUnique({
      where: { id },
      select: { id: true, ownerEmail: true },
    });
    if (!target) {
      return NextResponse.json({ error: "リードが見つかりません" }, { status: 404 });
    }
    if (!access.isAdmin && target.ownerEmail !== access.email) {
      return FORBIDDEN;
    }

    await db.franchiseLead.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Franchise lead delete error:", err);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
