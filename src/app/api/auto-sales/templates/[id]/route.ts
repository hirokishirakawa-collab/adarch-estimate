import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/// 1アカウントに許す1日の上限の上限。これを超える値は本部でも設定できない。
/// グループ全体の日次上限（ワーカーの DAILY_LIMIT）とは別の、拠点単位の歯止め。
const MAX_DAILY_LIMIT = 1000;

// テンプレート削除（ソフトデリート: isActive=false）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  const template = await db.autoSalesTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 自分の拠点のテンプレートか、ADMINのみ削除可能
  if (user.role !== "ADMIN" && template.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.autoSalesTemplate.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}

// テンプレート更新（優先順位等）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;
  const body = await req.json();

  const template = await db.autoSalesTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.role !== "ADMIN" && template.branchId !== user.branchId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};

  // 審査（ADMINのみ）: approve = 承認, reject = 差戻し, revoke = 承認取消
  if (body.reviewAction !== undefined) {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "本部のみ審査できます" }, { status: 403 });
    }

    const note: string | null = typeof body.reviewNote === "string" && body.reviewNote.trim()
      ? body.reviewNote.trim()
      : null;

    switch (body.reviewAction) {
      case "approve": {
        // 送信上限は必須。無制限は認めない（1社の暴走がグループ全体の毀損になるため）。
        // 未指定なら既存値（新規は既定200）を維持する。
        if (body.dailyLimit !== undefined) {
          const limit = Number(body.dailyLimit);
          if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DAILY_LIMIT) {
            return NextResponse.json(
              { error: `1日の送信上限は 1〜${MAX_DAILY_LIMIT} の整数で入力してください` },
              { status: 400 }
            );
          }
          updateData.dailyLimit = limit;
        }

        // 返信先が空のテンプレートは承認できない（ワーカーが送信を拒否するため）
        if (!template.email?.trim()) {
          return NextResponse.json(
            { error: "返信先アドレスが未設定です。拠点に設定を依頼してから承認してください。" },
            { status: 400 }
          );
        }

        updateData.isApproved = true;
        updateData.approvedAt = new Date();
        updateData.approvedBy = user.id;
        updateData.rejectedAt = null;
        updateData.reviewNote = note;
        break;
      }

      case "reject":
        // 差戻しには理由を必須にする。拠点が何を直せばよいか分からないため。
        if (!note) {
          return NextResponse.json({ error: "差戻しの理由を入力してください" }, { status: 400 });
        }
        updateData.isApproved = false;
        updateData.approvedAt = null;
        updateData.approvedBy = null;
        updateData.rejectedAt = new Date();
        updateData.reviewNote = note;
        break;

      case "revoke":
        // 承認済みを止める。稼働中のジョブは別途モニターの緊急停止で落とす。
        updateData.isApproved = false;
        updateData.approvedAt = null;
        updateData.approvedBy = null;
        updateData.reviewNote = note;
        break;

      default:
        return NextResponse.json({ error: "不明な審査アクションです" }, { status: 400 });
    }
  }

  // 再申請（差戻しを受けた拠点が出し直す）
  if (body.resubmit === true) {
    if (template.isApproved) {
      return NextResponse.json({ error: "承認済みのため再申請できません" }, { status: 400 });
    }
    updateData.submittedAt = new Date();
    updateData.rejectedAt = null;
  }

  // お気に入り
  if (body.isFavorite !== undefined) {
    updateData.isFavorite = body.isFavorite;
  }

  // アーカイブ / 復活
  if (body.isActive !== undefined) {
    updateData.isActive = body.isActive;
  }

  const updated = await db.autoSalesTemplate.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
