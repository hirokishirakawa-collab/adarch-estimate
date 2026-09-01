// ============================================================
// ロイヤリティ判定に使う「月次報告の売上」の取得（単一ソース）
//
//   売上(税抜) = RevenueReport.selfAmount + hqAmount
//               （明細導入前の旧データは両方0＝amount を使う）
//   帰属: 報告者(createdBy)の groupCompanyId × targetMonth の月
//   県別: RevenueReport.branch.name（例「山口県」）が branchLabels（例「山口」）で始まれば
//         その県に帰属。複数拠点の代表が1本の報告に全県分をまとめている場合は
//         最初の県に全額が乗る（＝現状のデータの入り方）。
// ============================================================

import { db } from "@/lib/db";

export type ReportedRevenue = {
  total: number; // 税抜（自社請求＋本部請求）
  selfTotal: number; // 自社請求（税抜）＝ロイヤリティ請求書に載る側
  hqTotal: number; // 本部請求（税抜）＝クライアント入金時に10%控除済みの側
  byLabel: Record<string, number>; // 県別（複数拠点のみ意味を持つ）
};

/// key = `${groupCompanyId}:${YYYY-MM}` → 売上
export async function fetchReportedRevenue(opts: {
  from: Date; // 含む
  to: Date; // 含まない
  groupCompanyId?: string | null;
  branchLabelsByCompany: Map<string, string[]>;
}): Promise<Map<string, ReportedRevenue>> {
  const reports = await db.revenueReport.findMany({
    where: {
      targetMonth: { gte: opts.from, lt: opts.to },
      ...(opts.groupCompanyId ? { createdBy: { groupCompanyId: opts.groupCompanyId } } : {}),
    },
    select: {
      targetMonth: true,
      amount: true,
      selfAmount: true,
      hqAmount: true,
      branch: { select: { name: true } },
      createdBy: { select: { groupCompanyId: true } },
    },
  });

  const out = new Map<string, ReportedRevenue>();
  for (const r of reports) {
    const gc = r.createdBy?.groupCompanyId;
    if (!gc) continue;
    const d = new Date(r.targetMonth);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const self = Number(r.selfAmount) || 0;
    const hq = Number(r.hqAmount) || 0;
    // 区分なし（旧データ）は amount を自社請求側に置く（本部請求なら請求申請の手数料で相殺される）
    const hasSplit = self + hq > 0;
    const selfRev = Math.max(0, Math.round(hasSplit ? self : Number(r.amount) || 0));
    const hqRev = Math.max(0, Math.round(hasSplit ? hq : 0));
    const revenue = selfRev + hqRev;
    const key = `${gc}:${month}`;
    const cur = out.get(key) ?? { total: 0, selfTotal: 0, hqTotal: 0, byLabel: {} };
    cur.total += revenue;
    cur.selfTotal += selfRev;
    cur.hqTotal += hqRev;
    const labels = opts.branchLabelsByCompany.get(gc) ?? [];
    if (labels.length > 1) {
      const branchName = r.branch?.name ?? "";
      const label = labels.find((l) => branchName.startsWith(l));
      if (label) cur.byLabel[label] = (cur.byLabel[label] ?? 0) + revenue;
    }
    out.set(key, cur);
  }
  return out;
}
