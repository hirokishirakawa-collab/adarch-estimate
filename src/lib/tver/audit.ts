// ==============================================================
// TVer配信の週次監査 — 申込台帳（TverOrder）と取り込んだ配信実績（TverDeliveryReport）を突き合わせる
//   設定はTVer管理画面で人が行い、検算はここで自動。少額プランが増えても「止め忘れ・止まっている・予算超過・終了間近」を見落とさない
//   保存はしない＝本部画面を開くたびに計算（2層のまま）
// ==============================================================

import { db } from "@/lib/db";
import { SELL_MULTIPLIER } from "@/lib/tver/plan";
import { orderNumberLabel } from "@/lib/tver-order/plans";

export type AuditKind = "STOP_MISSED" | "NOT_DELIVERING" | "OVER_BUDGET" | "ENDING_SOON" | "ENDED_STILL_LIVE" | "NO_REPORT" | "STALE_REPORT";
export type AuditItem = {
  kind: AuditKind;
  severity: "red" | "amber";
  title: string;
  detail: string;
  orderId: string;
  orderNo: string;
  advertiser: string;
  company: string;
  reportId?: string;
};

const DAY = 86_400_000;
const fmt = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d);
const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

/** 契約月の窓（配信開始日から1ヶ月ずつ）。k=0.. */
function monthWindow(start: Date, k: number): [Date, Date] {
  const a = new Date(start);
  a.setMonth(a.getMonth() + k);
  const b = new Date(start);
  b.setMonth(b.getMonth() + k + 1);
  return [a, b];
}

export async function weeklyAudit(now = new Date()): Promise<AuditItem[]> {
  const orders = await db.tverOrder.findMany({
    where: { status: { in: ["LIVE", "COMPLETED", "MATERIAL_RECEIVED"] } },
    select: {
      id: true, number: true, createdAt: true, advertiserName: true, status: true, months: true, mediaFeeExclTax: true,
      liveStartDate: true, liveEndDate: true,
      groupCompany: { select: { name: true } },
      deliveryReports: { select: { id: true, periodEnd: true, createdAt: true }, orderBy: { periodEnd: "desc" }, take: 1 },
    },
  });
  const items: AuditItem[] = [];

  for (const o of orders) {
    const base = { orderId: o.id, orderNo: orderNumberLabel(o.number, o.createdAt), advertiser: o.advertiserName, company: o.groupCompany?.name ?? "本部" };
    const latest = o.deliveryReports[0];
    const started = o.liveStartDate && o.liveStartDate.getTime() <= now.getTime();

    // 実績が無い／古い（配信中のものだけ）
    if (o.status === "LIVE") {
      if (!latest) {
        if (started && now.getTime() - o.liveStartDate!.getTime() >= 7 * DAY) {
          items.push({ ...base, kind: "NO_REPORT", severity: "amber", title: "実績が取り込まれていない", detail: `配信開始 ${fmt(o.liveStartDate!)} から実績CSVの取込がありません。TVerでレポートを作成して取り込んでください` });
        }
      } else if (now.getTime() - latest.periodEnd.getTime() > 10 * DAY) {
        items.push({ ...base, reportId: latest.id, kind: "STALE_REPORT", severity: "amber", title: "実績が古い", detail: `最新の実績は ${fmt(latest.periodEnd)} まで。今週のCSVを取り込んでください` });
      }
    }

    // 日別の合計（紐づいた全レポート）
    const daily = await db.tverDeliveryRow.groupBy({
      by: ["date"],
      where: { report: { tverOrderId: o.id } },
      _sum: { impressions: true, wholesaleAmount: true },
      orderBy: { date: "asc" },
    });
    const days = daily.map((d) => ({ date: d.date, imp: d._sum.impressions ?? 0, wholesale: d._sum.wholesaleAmount ?? 0 }));
    const lastDataDate = days.length ? days[days.length - 1].date : null;

    // 停止漏れ: 終了日の翌日以降に再生がある
    if (o.liveEndDate) {
      const after = days.filter((d) => d.date.getTime() > o.liveEndDate!.getTime() && d.imp > 0);
      if (after.length) {
        const imp = after.reduce((a, d) => a + d.imp, 0);
        items.push({ ...base, reportId: latest?.id, kind: "STOP_MISSED", severity: "red", title: "停止漏れの疑い", detail: `契約終了 ${fmt(o.liveEndDate)} の後も ${after.length}日・${imp.toLocaleString("ja-JP")}表示の配信があります（${fmt(after[0].date)}〜${fmt(after[after.length - 1].date)}）。TVerでキャンペーンを止めてください` });
      }
    }

    // 止まっている: 配信中なのに、実績の直近7日が0
    if (o.status === "LIVE" && started && lastDataDate && latest) {
      const from = latest.periodEnd.getTime() - 7 * DAY;
      const recent = days.filter((d) => d.date.getTime() > from && d.date.getTime() <= latest.periodEnd.getTime());
      const recentImp = recent.reduce((a, d) => a + d.imp, 0);
      const inContract = !o.liveEndDate || o.liveEndDate.getTime() >= latest.periodEnd.getTime();
      if (inContract && recentImp === 0) {
        items.push({ ...base, reportId: latest.id, kind: "NOT_DELIVERING", severity: "red", title: "配信が止まっている", detail: `${fmt(new Date(from))}〜${fmt(latest.periodEnd)} の表示回数が0です。TVerでキャンペーンの状態・予算・考査を確認してください` });
      }
    }

    // 予算超過: 契約月ごとの卸値 > 月額÷係数
    if (o.liveStartDate && o.mediaFeeExclTax > 0 && days.length) {
      const cap = o.mediaFeeExclTax / SELL_MULTIPLIER;
      for (let k = 0; k < o.months + 1; k++) {
        const [a, b] = monthWindow(o.liveStartDate, k);
        if (a.getTime() > now.getTime()) break;
        const spent = days.filter((d) => d.date.getTime() >= a.getTime() && d.date.getTime() < b.getTime()).reduce((s, d) => s + d.wholesale, 0);
        if (spent > cap * 1.02) {
          items.push({ ...base, reportId: latest?.id, kind: "OVER_BUDGET", severity: "red", title: "予算超過", detail: `契約${k + 1}ヶ月目（${fmt(a)}〜）の卸値 ${yen(spent)} が上限 ${yen(cap)}（月額${yen(o.mediaFeeExclTax)}÷${SELL_MULTIPLIER}）を超えています。TVerの予算設定を確認してください` });
        }
      }
    }

    // 終了間近／終了日を過ぎたのに配信中のまま
    if (o.status === "LIVE" && o.liveEndDate) {
      const left = Math.ceil((o.liveEndDate.getTime() - now.getTime()) / DAY);
      if (left < 0) {
        items.push({ ...base, kind: "ENDED_STILL_LIVE", severity: "amber", title: "契約終了日を過ぎている", detail: `終了 ${fmt(o.liveEndDate)}。TVerで停止を確認し、OSの申込を「配信終了・レポート済」に進めてください（延長なら終了日を更新）` });
      } else if (left <= 7) {
        items.push({ ...base, kind: "ENDING_SOON", severity: "amber", title: `あと${left}日で契約終了`, detail: `終了 ${fmt(o.liveEndDate)}。延長するならTVerの終了日と予算を延ばし、OSの終了日も更新。終了ならTVerで止まることを確認` });
      }
    }
  }

  const order: Record<"red" | "amber", number> = { red: 0, amber: 1 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}
