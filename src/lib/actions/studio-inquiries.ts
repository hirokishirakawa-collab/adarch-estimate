"use server";

// ==============================================================
// Ad Arch Studio の問い合わせ — OS側の操作
//   本部（ADMINだけ・ページ側の判定と二重）: 担当の付け替え／迷惑にする／削除（確定前だけ）／県の担当表／公開AI窓口に出すもの
//   拠点（担当拠点の人と本部）: 相談中にする／見送り／確定（発注条件の入力が必須＝本部→県本部の条件）
//   ⚠️ 外（問い合わせた企業）には何も送らない。連絡は担当が人の手で行う
// ==============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { canSeeBranch, getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { clearStudioCache } from "@/lib/studio/guard";
import { normalizePrefecture } from "@/lib/studio/routing";
import { inquiryNumberLabel } from "@/lib/studio/labels";
import type { Prisma } from "@/generated/prisma/client";

type R = { ok?: true; error?: string; message?: string };

const ADMIN_PATH = "/dashboard/admin/studio-inquiries";
const BRANCH_PATH = "/dashboard/studio-inquiries";

async function admin() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return null;
  return info;
}

function refresh() {
  revalidatePath(ADMIN_PATH);
  revalidatePath(BRANCH_PATH);
}

function pushHistory(prev: Prisma.JsonValue, entry: { by: string; action: string; note?: string }): Prisma.InputJsonValue {
  const arr = Array.isArray(prev) ? (prev as Prisma.InputJsonValue[]) : [];
  return [...arr, { at: new Date().toISOString(), ...entry }].slice(-100) as Prisma.InputJsonValue;
}

const cleanIds = (ids: string[]) => ids.filter((v) => typeof v === "string" && v.length > 0 && v.length < 64).slice(0, 200);

// ---------------- 本部 ----------------

/** 担当の付け替え。assignmentId=null で本部の一覧へ戻す */
export async function reassignStudioInquiry(id: string, assignmentId: string | null): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const row = await db.studioInquiry.findUnique({ where: { id }, select: { history: true } });
  if (!row) return { error: "見つかりません" };
  let target: { groupCompanyId: string | null; branchId: string | null; label: string } = { groupCompanyId: null, branchId: null, label: "本部" };
  if (assignmentId) {
    const a = await db.studioPrefectureAssignment.findUnique({ where: { id: assignmentId } });
    if (!a) return { error: "担当表の行が見つかりません" };
    const gc = await db.groupCompany.findUnique({ where: { id: a.groupCompanyId }, select: { name: true } });
    target = { groupCompanyId: a.groupCompanyId, branchId: a.branchId, label: `${a.prefecture} ${gc?.name ?? ""}` };
  }
  await db.studioInquiry.update({
    where: { id },
    data: {
      assignedGroupCompanyId: target.groupCompanyId,
      assignedBranchId: target.branchId,
      routeReason: `本部が付け替え（${target.label}）`,
      history: pushHistory(row.history, { by: info.staffName, action: "付け替え", note: target.label }),
    },
  });
  logAudit({ action: "studio_inquiry_reassigned", email: info.email, name: info.staffName, entity: "studio_inquiry", entityId: id, detail: target.label });
  refresh();
  return { ok: true, message: `${target.label}に付け替えました` };
}

export async function markStudioInquiriesSpam(ids: string[]): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const list = cleanIds(ids);
  const r = await db.studioInquiry.updateMany({ where: { id: { in: list }, status: { not: "CONFIRMED" } }, data: { status: "SPAM", suspectedSpam: true } });
  logAudit({ action: "studio_inquiry_spam", email: info.email, name: info.staffName, entity: "studio_inquiry", detail: `${r.count}件を迷惑に` });
  refresh();
  return { ok: true, message: `${r.count}件を迷惑にしました（確定済みは対象外）` };
}

/** 削除は確定前だけ（確定済みは発注の記録として残す） */
export async function deleteStudioInquiries(ids: string[]): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const list = cleanIds(ids);
  const r = await db.studioInquiry.deleteMany({ where: { id: { in: list }, status: { not: "CONFIRMED" } } });
  logAudit({ action: "studio_inquiry_deleted", email: info.email, name: info.staffName, entity: "studio_inquiry", detail: `${r.count}件を削除（確定前のみ）` });
  refresh();
  return { ok: true, message: `${r.count}件を削除しました（確定済みは残しています）` };
}

/** 県の担当表に1行足す。拠点IDは、その社に紐づくユーザーの所属から決める */
export async function addStudioAssignment(prefectureRaw: string, groupCompanyId: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const prefecture = normalizePrefecture(prefectureRaw);
  if (!prefecture) return { error: "都道府県を選んでください" };
  const gc = await db.groupCompany.findUnique({ where: { id: groupCompanyId }, select: { name: true, isActive: true } });
  if (!gc?.isActive) return { error: "県本部が見つかりません" };
  const user = await db.user.findFirst({ where: { groupCompanyId, isActive: true, branchId: { not: null } }, select: { branchId: true }, orderBy: { createdAt: "asc" } });
  if (!user?.branchId) return { error: `${gc.name}に所属する（拠点が設定された）ユーザーがいません。メンバー管理で拠点を設定してください` };
  await db.studioPrefectureAssignment.upsert({
    where: { prefecture_groupCompanyId: { prefecture, groupCompanyId } },
    update: { active: true, branchId: user.branchId },
    create: { prefecture, groupCompanyId, branchId: user.branchId },
  });
  logAudit({ action: "studio_assignment_saved", email: info.email, name: info.staffName, entity: "studio_assignment", detail: `${prefecture} ${gc.name}` });
  refresh();
  return { ok: true, message: `${prefecture}に${gc.name}を登録しました` };
}

export async function setStudioAssignmentActive(id: string, active: boolean): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  await db.studioPrefectureAssignment.update({ where: { id }, data: { active } });
  logAudit({ action: "studio_assignment_saved", email: info.email, name: info.staffName, entity: "studio_assignment", entityId: id, detail: active ? "有効" : "停止" });
  refresh();
  return { ok: true };
}

export async function deleteStudioAssignment(id: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  await db.studioPrefectureAssignment.delete({ where: { id } });
  logAudit({ action: "studio_assignment_saved", email: info.email, name: info.staffName, entity: "studio_assignment", entityId: id, detail: "削除" });
  refresh();
  return { ok: true };
}

/**
 * 公開MCPに出すもの（本部が選ぶ）。type ごとに丸ごと入れ替える
 *   PACKAGE＝稼働中のパッケージ（金額は外に出さない）／KNOWLEDGE＝制作の技術の自社資料（他社・媒体社・本部限定は選べない）／WIKI＝「本部のみ」等でない記事
 *   SPEC＝媒体の入稿仕様（資料ライブラリ。媒体社の資料も可・本部限定は不可。外には整理済みの仕様の要点だけ出る）
 */
export async function setStudioPublished(type: "PACKAGE" | "KNOWLEDGE" | "WIKI" | "SPEC", refIds: string[]): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  if (!["PACKAGE", "KNOWLEDGE", "WIKI", "SPEC"].includes(type)) return { error: "種類が不正です" };
  const ids = cleanIds(refIds);
  let ok: string[] = [];
  if (type === "PACKAGE") {
    const rows = await db.salesPackage.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true } });
    ok = ids.filter((id) => rows.some((r) => r.id === id));
  } else if (type === "KNOWLEDGE") {
    const rows = await db.knowledgeSource.findMany({ where: { id: { in: ids }, origin: "OWN", hqOnly: false }, select: { id: true } });
    ok = ids.filter((id) => rows.some((r) => r.id === id));
  } else if (type === "SPEC") {
    const rows = await db.knowledgeSource.findMany({ where: { id: { in: ids }, hqOnly: false }, select: { id: true } });
    ok = ids.filter((id) => rows.some((r) => r.id === id));
  } else {
    const rows = await db.wikiArticle.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
    ok = ids.filter((id) => rows.some((r) => r.id === id && !/ADMIN向け|ADMIN専用|本部のみ/i.test(r.title)));
  }
  await db.$transaction([
    db.studioPublishedItem.deleteMany({ where: { type } }),
    db.studioPublishedItem.createMany({ data: ok.map((refId, i) => ({ type, refId, sortOrder: i })) }),
  ]);
  clearStudioCache(type === "PACKAGE" ? "studio:services" : type === "SPEC" ? "studio:specs" : "studio:guides");
  logAudit({ action: "studio_published", email: info.email, name: info.staffName, entity: "studio_published", detail: `${type} ${ok.length}件を公開` });
  refresh();
  return { ok: true, message: `${ok.length}件を公開にしました${ok.length < ids.length ? `（${ids.length - ok.length}件は公開できない種類のため外しました）` : ""}` };
}

// ---------------- 拠点（と本部） ----------------

async function loadForBranch(id: string) {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインしてください" as const };
  const row = await db.studioInquiry.findUnique({ where: { id }, select: { id: true, number: true, createdAt: true, status: true, assignedBranchId: true, history: true, firstRepliedAt: true } });
  if (!row) return { error: "見つかりません" as const };
  // 本部は全部。拠点は自拠点に振られたものだけ（未割当＝本部の一覧は触れない）
  if (info.role !== "ADMIN" && (!row.assignedBranchId || !canSeeBranch(info, row.assignedBranchId))) return { error: "この問い合わせは担当外です" as const };
  return { info, row };
}

/** 相談中にする（担当が連絡した）／見送り */
export async function updateStudioInquiryStatus(id: string, status: "CONSULTING" | "DECLINED", note: string): Promise<R> {
  if (status !== "CONSULTING" && status !== "DECLINED") return { error: "状態が不正です" };
  const got = await loadForBranch(id);
  if ("error" in got) return { error: got.error };
  const { info, row } = got;
  if (row.status === "CONFIRMED") return { error: "確定済みです" };
  await db.studioInquiry.update({
    where: { id },
    data: {
      status,
      firstRepliedAt: row.firstRepliedAt ?? new Date(),
      history: pushHistory(row.history, { by: info.staffName, action: status === "CONSULTING" ? "相談中（連絡済み）" : "見送り", note: note.slice(0, 1000) }),
    },
  });
  logAudit({ action: "studio_inquiry_updated", email: info.email, name: info.staffName, entity: "studio_inquiry", entityId: id, detail: `${inquiryNumberLabel(row.number, row.createdAt)} → ${status}` });
  refresh();
  revalidatePath(`${BRANCH_PATH}/${id}`);
  return { ok: true, message: status === "CONSULTING" ? "相談中にしました" : "見送りにしました" };
}

/** 確定（発注条件＝本部→県本部の 内容・金額・納期・支払日 が必須） */
export async function confirmStudioInquiry(
  id: string,
  input: { scope: string; amountExclTax: number; dueDate: string; paymentDate: string },
): Promise<R> {
  const got = await loadForBranch(id);
  if ("error" in got) return { error: got.error };
  const { info, row } = got;
  if (row.status === "CONFIRMED") return { error: "確定済みです" };
  const scope = (input.scope ?? "").trim();
  const amount = Math.round(Number(input.amountExclTax));
  const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");
  if (scope.length < 5) return { error: "発注の内容を入力してください（5文字以上）" };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return { error: "金額（税抜・円）を入力してください" };
  if (!isDay(input.dueDate)) return { error: "納期を入力してください" };
  if (!isDay(input.paymentDate)) return { error: "支払日を入力してください" };
  const toJst = (d: string) => new Date(`${d}T00:00:00+09:00`);
  await db.studioInquiry.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      orderScope: scope.slice(0, 4000),
      orderAmountExclTax: amount,
      orderDueDate: toJst(input.dueDate),
      orderPaymentDate: toJst(input.paymentDate),
      confirmedAt: new Date(),
      confirmedById: info.userId,
      firstRepliedAt: row.firstRepliedAt ?? new Date(),
      history: pushHistory(row.history, { by: info.staffName, action: "確定（発注条件を記録）" }),
    },
  });
  // 金額は監査ログにも書かない（本部と担当拠点の画面だけで見る）
  logAudit({ action: "studio_inquiry_confirmed", email: info.email, name: info.staffName, entity: "studio_inquiry", entityId: id, detail: inquiryNumberLabel(row.number, row.createdAt) });
  refresh();
  revalidatePath(`${BRANCH_PATH}/${id}`);
  return { ok: true, message: "確定しました（発注条件を記録しました）" };
}

/** 拠点の一括見送り（拠点の一覧は削除の代わりにこれ＝記録は本部に残す） */
export async function declineStudioInquiries(ids: string[]): Promise<R> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインしてください" };
  const list = cleanIds(ids);
  const rows = await db.studioInquiry.findMany({ where: { id: { in: list }, status: { in: ["RECEIVED", "CONSULTING"] } }, select: { id: true, assignedBranchId: true, history: true } });
  const mine = rows.filter((r) => info.role === "ADMIN" || (!!r.assignedBranchId && canSeeBranch(info, r.assignedBranchId)));
  for (const r of mine) {
    await db.studioInquiry.update({ where: { id: r.id }, data: { status: "DECLINED", history: pushHistory(r.history, { by: info.staffName, action: "見送り（一括）" }) } });
  }
  logAudit({ action: "studio_inquiry_updated", email: info.email, name: info.staffName, entity: "studio_inquiry", detail: `${mine.length}件を見送り` });
  refresh();
  return { ok: true, message: `${mine.length}件を見送りにしました` };
}
