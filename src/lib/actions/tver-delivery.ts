"use server";

// ==============================================================
// TVer配信実績 — 本部の操作（ADMINだけ。ページ側の判定と二重）
//   CSV取込／紐づけ（拠点・申込）／確認完了＝公開／公開取消／一括削除
//   卸値は本部にしか返さない。拠点向けの読み取りは画面側で sell* だけを選ぶ
// ==============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { parseDeliveryCsv } from "@/lib/tver/delivery-csv";

const PATH = "/dashboard/admin/tver-reports";
const PARTNER_PATH = "/dashboard/tver-reports";
type R = { error?: string; ok?: boolean; message?: string; id?: string };

async function admin() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return null;
  return info;
}

const MAX_BYTES = 20 * 1024 * 1024;

/** CSVを取り込む（IMPORTED＝拠点にはまだ見えない）。同じ広告主の前回の紐づけを既定にする */
export async function importDeliveryCsv(fd: FormData): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "CSVファイルを選んでください" };
  if (file.size > MAX_BYTES) return { error: "ファイルが大きすぎます（20MBまで）" };

  let parsed;
  try {
    parsed = parseDeliveryCsv(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "CSVを読めませんでした" };
  }

  // 同じ広告主・同じ期間の取込が既にあれば止める（二重計上の防止）
  const dup = await db.tverDeliveryReport.findFirst({
    where: { advertiserTverId: parsed.advertiserTverId, periodStart: parsed.periodStart, periodEnd: parsed.periodEnd },
    select: { id: true, fileName: true },
  });
  if (dup) return { error: `同じ広告主・同じ期間のレポートが既にあります（${dup.fileName}）。差し替える時は先に削除してください` };

  // 前回の紐づけを引き継ぐ
  const prev = await db.tverDeliveryReport.findFirst({
    where: { advertiserTverId: parsed.advertiserTverId, groupCompanyId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { groupCompanyId: true, tverOrderId: true },
  });
  const groupCompanyId = String(fd.get("groupCompanyId") ?? "").trim() || prev?.groupCompanyId || null;
  const tverOrderId = String(fd.get("tverOrderId") ?? "").trim() || prev?.tverOrderId || null;

  const { rows, ...head } = parsed;
  const created = await db.tverDeliveryReport.create({
    data: {
      fileName: file.name.slice(0, 200),
      ...head,
      rowCount: rows.length,
      groupCompanyId,
      tverOrderId,
      importedByEmail: info.email,
      adminNote: String(fd.get("adminNote") ?? "").trim().slice(0, 2000) || null,
    },
    select: { id: true },
  });
  // 明細は分割して投入（2,000〜3,000行/月）
  for (let i = 0; i < rows.length; i += 1000) {
    await db.tverDeliveryRow.createMany({ data: rows.slice(i, i + 1000).map((r) => ({ ...r, reportId: created.id })) });
  }
  logAudit({ action: "tver_delivery_imported", email: info.email, name: info.staffName, entity: "tver_delivery_report", entityId: created.id, detail: `${parsed.advertiserName} ${rows.length}行 卸¥${parsed.wholesaleAmount.toLocaleString("ja-JP")}→売¥${parsed.sellAmount.toLocaleString("ja-JP")}${parsed.warnings.length ? `（警告${parsed.warnings.length}）` : ""}` });
  revalidatePath(PATH);
  return { ok: true, id: created.id, message: `取り込みました（${rows.length}行）${parsed.warnings.length ? `。警告が${parsed.warnings.length}件あります` : ""}` };
}

/** 紐づけ・メモを保存（公開状態は変えない） */
export async function updateDeliveryReport(id: string, fd: FormData): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const r = await db.tverDeliveryReport.findUnique({ where: { id }, select: { id: true } });
  if (!r) return { error: "レポートが見つかりません" };
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  await db.tverDeliveryReport.update({
    where: { id },
    data: {
      groupCompanyId: s("groupCompanyId") || null,
      tverOrderId: s("tverOrderId") || null,
      adminNote: s("adminNote").slice(0, 2000) || null,
      partnerNote: s("partnerNote").slice(0, 2000) || null,
    },
  });
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  revalidatePath(PARTNER_PATH);
  return { ok: true, message: "保存しました" };
}

/** 確認完了＝紐づけた拠点に公開。紐づけが無いと公開できない */
export async function publishDeliveryReport(id: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const r = await db.tverDeliveryReport.findUnique({ where: { id }, select: { groupCompanyId: true, advertiserName: true, sellAmount: true, status: true } });
  if (!r) return { error: "レポートが見つかりません" };
  if (!r.groupCompanyId) return { error: "公開先の拠点を先に選んでください" };
  await db.tverDeliveryReport.update({ where: { id }, data: { status: "PUBLISHED", confirmedAt: new Date(), confirmedByEmail: info.email } });
  logAudit({ action: "tver_delivery_published", email: info.email, name: info.staffName, entity: "tver_delivery_report", entityId: id, detail: `${r.advertiserName} 売¥${r.sellAmount.toLocaleString("ja-JP")} を拠点に公開` });
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  revalidatePath(PARTNER_PATH);
  return { ok: true, message: "確認完了＝拠点に公開しました" };
}

/** 公開を取り消す（拠点から見えなくなる） */
export async function unpublishDeliveryReport(id: string): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  await db.tverDeliveryReport.update({ where: { id }, data: { status: "IMPORTED", confirmedAt: null, confirmedByEmail: null } });
  logAudit({ action: "tver_delivery_unpublished", email: info.email, name: info.staffName, entity: "tver_delivery_report", entityId: id, detail: "公開を取り消し" });
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
  revalidatePath(PARTNER_PATH);
  return { ok: true, message: "公開を取り消しました" };
}

/** 一括削除（明細も消える） */
export async function deleteDeliveryReports(ids: string[]): Promise<R> {
  const info = await admin();
  if (!info) return { error: "権限がありません" };
  const list = ids.filter((x) => typeof x === "string" && x).slice(0, 200);
  if (list.length === 0) return { error: "対象がありません" };
  const res = await db.tverDeliveryReport.deleteMany({ where: { id: { in: list } } });
  logAudit({ action: "tver_delivery_deleted", email: info.email, name: info.staffName, entity: "tver_delivery_report", entityId: list[0], detail: `${res.count}件削除` });
  revalidatePath(PATH);
  revalidatePath(PARTNER_PATH);
  return { ok: true, message: `${res.count}件削除しました` };
}
