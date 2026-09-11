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
import { isActionWarning, orderNumberFromName, parseDeliveryCsv, summarize } from "@/lib/tver/delivery-csv";
import { areaFromKey, areaFromNames, areaFromOrder, areaFromPrefectures } from "@/lib/tver/report-area";

const PATH = "/dashboard/admin/tver-reports";
const PARTNER_PATH = "/dashboard/tver-reports";
type R = { error?: string; ok?: boolean; message?: string; id?: string };

async function admin() {
  const info = await getSessionInfo();
  if (!info || info.role !== "ADMIN") return null;
  return info;
}

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * CSVを取り込む。
 *  - 同じ広告主で期間が重なるレポートがあれば「差し替え」＝新しいCSVに含まれる日付の行を入れ替えて再集計（毎週の再取込用）。
 *    公開済みは公開のまま更新。再集計で警告が出た時だけ確認待ち（非公開）に戻す
 *  - 重なりが無ければ新規（IMPORTED＝拠点にはまだ見えない）
 *  - キャンペーン名にOSの申込番号（TV-2026-0042）があれば申込と拠点を自動で紐づけ。無ければ同じ広告主の前回の紐づけを引き継ぐ
 */
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
  const { rows, ...head } = parsed;

  // 申込番号からの自動紐づけ（キャンペーン名 / 広告グループ名 / クリエイティブ名のどれかに TV-YYYY-NNNN）
  const numbers = new Set<number>();
  for (const n of [...head.campaignNames, ...rows.map((r) => r.adGroupName), ...rows.map((r) => r.creativeName)]) {
    const x = orderNumberFromName(n);
    if (x) numbers.add(x);
  }
  const linkedOrder = numbers.size ? await db.tverOrder.findFirst({ where: { number: { in: [...numbers] } }, select: { id: true, groupCompanyId: true, industry: true, prefName: true, municipalityCode: true, areaLabel: true } }) : null;
  const prev = await db.tverDeliveryReport.findFirst({
    where: { advertiserTverId: head.advertiserTverId, groupCompanyId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { groupCompanyId: true, tverOrderId: true, industry: true, areaLabel: true, areaPopulation: true },
  });
  const groupCompanyId = String(fd.get("groupCompanyId") ?? "").trim() || linkedOrder?.groupCompanyId || prev?.groupCompanyId || null;
  const tverOrderId = linkedOrder?.id || String(fd.get("tverOrderId") ?? "").trim() || prev?.tverOrderId || null;
  const adminNote = String(fd.get("adminNote") ?? "").trim().slice(0, 2000) || null;
  const industry = String(fd.get("industry") ?? "").trim().slice(0, 100) || linkedOrder?.industry || prev?.industry || null;
  // 商圏: 申込の市区町村 → 無ければ明細の県全域
  // 商圏: 申込の市区町村 → 名前に含まれる市区町村名 → 明細の県全域
  const prefs = rows.map((r) => r.prefecture);
  const area = linkedOrder
    ? areaFromOrder(linkedOrder.prefName, linkedOrder.municipalityCode, linkedOrder.areaLabel)
    : areaFromNames(prefs, [...head.campaignNames, ...rows.map((r) => r.adGroupName), ...rows.map((r) => r.creativeName)]) ?? areaFromPrefectures(prefs);
  const areaFromName = !linkedOrder && !!areaFromNames(prefs, head.campaignNames);
  // 申込にも名前にも無ければ、同じ広告主の前回の商圏（本部が1回選んだもの）を引き継ぐ
  const prevArea = prev?.areaLabel && prev.areaPopulation ? { areaLabel: prev.areaLabel, areaPopulation: prev.areaPopulation } : null;
  const areaResolved = linkedOrder || areaFromName ? area : prevArea ?? area;

  // 同じ広告主で期間が重なる既存レポート → 差し替え
  const overlaps = await db.tverDeliveryReport.findMany({
    where: { advertiserTverId: head.advertiserTverId, periodStart: { lte: head.periodEnd }, periodEnd: { gte: head.periodStart } },
    select: { id: true, status: true, fileName: true, adminNote: true, warnings: true },
    orderBy: { createdAt: "desc" },
  });
  if (overlaps.length > 1) {
    return { error: `期間が重なるレポートが${overlaps.length}件あります（${overlaps.map((o) => o.fileName).join("・")}）。1件に整理してから取り込んでください` };
  }

  if (overlaps.length === 1) {
    const ex = overlaps[0];
    const result = await db.$transaction(async (tx) => {
      await tx.tverDeliveryRow.deleteMany({ where: { reportId: ex.id, date: { gte: head.periodStart, lte: head.periodEnd } } });
      for (let i = 0; i < rows.length; i += 1000) {
        await tx.tverDeliveryRow.createMany({ data: rows.slice(i, i + 1000).map((r) => ({ ...r, reportId: ex.id })) });
      }
      const all = await tx.tverDeliveryRow.findMany({ where: { reportId: ex.id } });
      const sum = summarize(all, head.advertiserTverId, head.advertiserName);
      const preWarn = head.warnings.filter((w) => !sum.warnings.includes(w) && /日付を読めない|広告主が複数/.test(w));
      const warnings = [...preWarn, ...sum.warnings];
      const demote = ex.status === "PUBLISHED" && warnings.some(isActionWarning);
      await tx.tverDeliveryReport.update({
        where: { id: ex.id },
        data: {
          fileName: file.name.slice(0, 200),
          ...sum,
          warnings,
          rowCount: all.length,
          importedByEmail: info.email,
          ...(groupCompanyId ? { groupCompanyId } : {}),
          ...(tverOrderId ? { tverOrderId } : {}),
          ...(industry ? { industry } : {}),
          ...((linkedOrder || areaFromName) && area ? area : {}),
          ...(adminNote ? { adminNote } : {}),
          ...(demote ? { status: "IMPORTED", confirmedAt: null, confirmedByEmail: null, adminNote: `${ex.adminNote ? ex.adminNote + "\n" : ""}【自動】${new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })} 再取込で警告が出たため非公開に戻しました` } : {}),
        },
      });
      return { total: all.length, replaced: rows.length, warnings: warnings.length, demote, sum };
    });
    logAudit({ action: "tver_delivery_reimported", email: info.email, name: info.staffName, entity: "tver_delivery_report", entityId: ex.id, detail: `${head.advertiserName} ${result.replaced}行差し替え（計${result.total}行）卸¥${result.sum.wholesaleAmount.toLocaleString("ja-JP")}→売¥${result.sum.sellAmount.toLocaleString("ja-JP")}${result.demote ? "・警告のため非公開に" : ""}` });
    revalidatePath(PATH);
    revalidatePath(`${PATH}/${ex.id}`);
    revalidatePath(PARTNER_PATH);
    return { ok: true, id: ex.id, message: `既存のレポートを差し替えました（${result.replaced}行を更新・計${result.total}行）${result.demote ? "。警告が出たため確認待ちに戻しました" : ex.status === "PUBLISHED" ? "。公開のまま最新になりました" : ""}` };
  }

  const created = await db.tverDeliveryReport.create({
    data: { fileName: file.name.slice(0, 200), ...head, rowCount: rows.length, groupCompanyId, tverOrderId, industry, ...(areaResolved ?? {}), importedByEmail: info.email, adminNote },
    select: { id: true },
  });
  for (let i = 0; i < rows.length; i += 1000) {
    await db.tverDeliveryRow.createMany({ data: rows.slice(i, i + 1000).map((r) => ({ ...r, reportId: created.id })) });
  }
  logAudit({ action: "tver_delivery_imported", email: info.email, name: info.staffName, entity: "tver_delivery_report", entityId: created.id, detail: `${head.advertiserName} ${rows.length}行 卸¥${head.wholesaleAmount.toLocaleString("ja-JP")}→売¥${head.sellAmount.toLocaleString("ja-JP")}${head.warnings.length ? `（警告${head.warnings.length}）` : ""}${linkedOrder ? "・申込番号で自動紐づけ" : ""}` });
  revalidatePath(PATH);
  return { ok: true, id: created.id, message: `取り込みました（${rows.length}行）${head.warnings.length ? `。警告が${head.warnings.length}件あります` : ""}${linkedOrder ? "。申込番号で自動的に紐づけました" : ""}` };
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
      industry: s("industry").slice(0, 100) || null,
      ...(s("areaKey") ? areaFromKey(s("areaKey")) ?? {} : {}),
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
