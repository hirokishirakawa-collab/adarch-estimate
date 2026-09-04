// ==============================================================
// ブランドキット — グループの実データ（匿名集計）
//   社名・金額・個人名・自由記述は出さない。件数と分布だけを返す。
//   材料の「グループの実データ」節はここから自動で組む。
// ==============================================================

import { db } from "@/lib/db";

export interface GroupDataSummary {
  approachIndustries: { industry: string; sent: number; replied: number; won: number }[]; // 反応が出た業種（送付≥2件）
  approachMethods: { method: string; sent: number; replied: number }[];
  wonIndustries: { industry: string; count: number }[]; // 受注商談の業種分布
  challenges: { label: string; count: number }[]; // ヒアリングの「最も解決したい課題」
  channels: { label: string; count: number }[]; // ヒアリングの「いまの集客手段」
  budgets: { label: string; count: number }[]; // ヒアリングの「月間広告費」
  totals: { approaches: number; wonDeals: number; hearings: number };
}

const METHOD_LABEL: Record<string, string> = { EMAIL: "メール", FORM: "問い合わせフォーム", DM: "DM", PHONE: "電話", VISIT: "訪問", OTHER: "その他" };

function topCounts(values: (string | null | undefined)[], take = 8): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = (v ?? "").trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([label, count]) => ({ label, count }));
}

/** 全グループの匿名集計（パッケージを指定すると、そのパッケージに紐づく営業の反応だけ業種別に出す） */
export async function getGroupDataSummary(packageId?: string): Promise<GroupDataSummary> {
  const [approaches, wonDeals, hearings] = await Promise.all([
    db.salesApproach.findMany({
      where: packageId ? { packageId } : {},
      select: { industry: true, method: true, result: true },
    }),
    db.deal.findMany({ where: { status: "CLOSED_WON" }, select: { customer: { select: { industry: true } } } }),
    db.hearingSheet.findMany({ select: { primaryChallenge: true, currentChannels: true, monthlyAdBudget: true } }),
  ]);

  const byIndustry = new Map<string, { sent: number; replied: number; won: number }>();
  const byMethod = new Map<string, { sent: number; replied: number }>();
  for (const a of approaches) {
    const ind = a.industry.trim() || "（業種未記入）";
    const row = byIndustry.get(ind) ?? { sent: 0, replied: 0, won: 0 };
    row.sent++;
    if (a.result === "REPLIED_OK" || a.result === "DEAL") row.replied++;
    if (a.result === "DEAL") row.won++;
    byIndustry.set(ind, row);
    const mrow = byMethod.get(a.method) ?? { sent: 0, replied: 0 };
    mrow.sent++;
    if (a.result === "REPLIED_OK" || a.result === "DEAL") mrow.replied++;
    byMethod.set(a.method, mrow);
  }

  const approachIndustries = [...byIndustry.entries()]
    .filter(([, r]) => r.sent >= 2)
    .map(([industry, r]) => ({ industry, ...r }))
    .sort((a, b) => b.replied - a.replied || b.sent - a.sent)
    .slice(0, 8);
  const approachMethods = [...byMethod.entries()]
    .map(([m, r]) => ({ method: METHOD_LABEL[m] ?? m, ...r }))
    .sort((a, b) => b.sent - a.sent);

  return {
    approachIndustries,
    approachMethods,
    wonIndustries: topCounts(wonDeals.map((d) => d.customer.industry)).map((x) => ({ industry: x.label, count: x.count })),
    challenges: topCounts(hearings.map((h) => h.primaryChallenge), 6),
    channels: topCounts(hearings.flatMap((h) => h.currentChannels), 8),
    budgets: topCounts(hearings.map((h) => h.monthlyAdBudget), 6),
    totals: { approaches: approaches.length, wonDeals: wonDeals.length, hearings: hearings.length },
  };
}

/** 材料の節に落とす（件数の細かい数字は出さず、順位と傾向で書く） */
export function renderGroupData(g: GroupDataSummary, asOf: string): string {
  const lines: string[] = [];
  lines.push(`※社名・金額・件数の詳細は書かない。「グループに実績があります」「同じ業種で実績があります」までは言ってよい。（${asOf}時点のOSの匿名集計）`);
  lines.push("");
  if (g.approachIndustries.length) {
    lines.push("**営業文の反応（グループのフォーム・メール営業の記録から）**");
    const ok = g.approachIndustries.filter((r) => r.replied > 0).map((r) => r.industry);
    if (ok.length) lines.push(`- 返信や商談につながった業種: ${ok.join("／")}`);
    const won = g.approachIndustries.filter((r) => r.won > 0).map((r) => r.industry);
    if (won.length) lines.push(`- 受注につながった業種: ${won.join("／")}`);
    const best = [...g.approachMethods].sort((a, b) => b.replied / Math.max(1, b.sent) - a.replied / Math.max(1, a.sent))[0];
    if (best && best.sent >= 3) lines.push(`- 反応率が高い送り方: ${best.method}`);
    lines.push("- 短くてよい。長い自己紹介より、用件と「提案の機会をいただけないか」を先に");
    lines.push("- 相手の事業に触れた一文（その業界への理解、地元×全国）を入れる");
    lines.push("");
  }
  if (g.wonIndustries.length) {
    lines.push("**受注の実績（グループの受注商談の記録から）**");
    lines.push(`- 業種の分布（多い順）: ${g.wonIndustries.map((w) => w.industry).join("、")}`);
    lines.push("- 「同じ業種でグループに実績があります」と言える。社名・金額は言わない");
    lines.push("");
  }
  if (g.challenges.length || g.channels.length) {
    lines.push("**お客様の悩み（グループのヒアリング記録から）**");
    if (g.challenges.length) lines.push(`- 最も解決したい課題（多い順）: ${g.challenges.map((c) => c.label).join(" ＞ ")}`);
    if (g.channels.length) lines.push(`- いまの集客手段（多い順）: ${g.channels.map((c) => c.label).join("、")}`);
    if (g.budgets.length) lines.push(`- 月間広告費の帯（多い順）: ${g.budgets.map((c) => c.label).join("、")}`);
    lines.push("- 使い方: 相手の業種に合う悩みを1つだけ冒頭に置く。決めつけず「〜というお話をよく伺います」の形にする");
    lines.push("");
  }
  lines.push("**言ってよい実績の数字（公開情報）**");
  lines.push("- Ad Archグループ: 累計制作2,000本以上／取引500社以上／全国24拠点");
  lines.push("- 本部の立ち位置: 「地方の事業を全国的にPR」");
  return lines.join("\n");
}
