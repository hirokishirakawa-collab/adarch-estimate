// ==============================================================
// リード獲得AI「今日の判定基準」
//   OS/MCPに溜まる結果（受注した顧客・送付結果・アポ/商談化とスキップ）から、
//   1日1回だけ判定の補正ルールを組み立て、スコアAPIが読む。
//
//   方針（2026-09-09 代表決定）
//   ・毎日変わる。ただし根拠件数が閾値に届いた項目だけ動かし、届かないものは固定
//   ・補正は AI の素点に対する加減点（合計 -6〜+8 の範囲）。理由と件数を必ず添える
//   ・画面に「更新日・根拠件数・今日効いている補正」を出し、変わった理由を説明できる状態を保つ
//
//   材料（直近180日）
//   ・受注: Deal.status=CLOSED_WON の顧客の業種・都道府県（リードに紐づかなくても使う）
//   ・送付結果: Lead.outreachResult（返信あり/受注 vs 無反応/断り）
//   ・判断: Lead.status アポ/商談化 vs スキップ（成功プロファイルと同じ材料の件数だけ）
// ==============================================================

import { db } from "@/lib/db";
import { PREFECTURES } from "@/lib/constants/crm";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeCompanyName } from "@/lib/leads/match-score";

export const BASIS_WINDOW_DAYS = 180;
export const BASIS_MIN_DELTA = -6;
export const BASIS_MAX_DELTA = 8;

// ---------------------------------------------------------------
// 業種の「家族」= 顧客管理・リード・アプローチ事例で語彙がばらばらなので、キーワードで束ねる
// ---------------------------------------------------------------
const FAMILY_RULES: [string, RegExp][] = [
  // 団体・自治体は「観光協会」等が観光に吸われないよう先に判定する
  ["自治体・団体", /協会|商工会|振興会|市役所|市民局|県庁|町役場|役場|一般社団|公益社団|公益財団|一般財団|財団法人|NPO|組合|事務局|コミッション|自治体|官公庁|公共|青年会議所/],
  ["飲食", /飲食|レストラン|カフェ|居酒屋|フード|食堂|ラーメン|焼肉|寿司|バー|restaurant|cafe/i],
  ["美容・健康", /美容|エステ|ヘア|サロン|ネイル|理容|整体|整骨|鍼灸|マッサージ|フィットネス|ジム|ヨガ|beauty|salon|gym/i],
  ["住宅・建設・不動産", /住宅|建設|建築|工務|工法|建材|リフォーム|不動産|ハウス|土木|設備|塗装|外構|construction|real_estate|estate/i],
  ["医療・介護", /医療|クリニック|病院|歯科|眼科|介護|福祉|薬局|dental|clinic|hospital|doctor/i],
  ["教育", /教育|塾|スクール|学校|教室|保育|幼稚園|school/i],
  ["自動車", /自動車|カー用品|車|バイク|ディーラー|car_|automotive/i],
  ["観光・宿泊・レジャー", /ホテル|旅館|宿泊|観光|レジャー|温泉|リゾート|遊園|hotel|lodging|tourist/i],
  ["冠婚葬祭", /結婚|ウェディング|葬|冠婚|wedding|funeral/i],
  ["小売・EC", /小売|物販|EC|ショップ|販売店|store|shop|retail/i],
  ["製造", /製造|工場|メーカー|加工|manufactur/i],
  ["運輸・物流", /運輸|物流|運送|郵便|倉庫|logistic/i],
  ["IT・広告・メディア", /IT|情報通信|Web|ソフト|広告|メディア|マーケ|テクノロジー|software|advertis/i],
  ["サービス・BtoB", /士業|税理士|弁護士|司法書士|社労士|コンサル|サービス業|協会|団体|組合|卸売|商社/i],
];

/** 業種の文字列（自由入力・分類語・Google types いずれでも）→ 家族名。判定できなければ "その他" */
export function industryFamily(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "その他";
  for (const [fam, re] of FAMILY_RULES) if (re.test(v)) return fam;
  return "その他";
}

/**
 * 顧客の家族。顧客管理の業種が「その他」「未入力」のときだけ、社名＋案件名から推定する（代表指示 2026-09-09）。
 * 推定した分は inferred=true で返し、画面・理由文に「推定含む」と明記する。
 */
export function familyForCustomer(industry: string | null | undefined, name: string, dealTitle?: string | null): { family: string; inferred: boolean } {
  const fam = industryFamily(industry);
  if (fam !== "その他") return { family: fam, inferred: false };
  const guess = industryFamily(`${name} ${dealTitle ?? ""}`);
  return { family: guess, inferred: guess !== "その他" };
}

/** 「高松市 香川県」「香川県高松市」等から都道府県名を拾う */
export function prefectureIn(text: string | null | undefined): string | null {
  if (!text) return null;
  return PREFECTURES.find((p) => p !== "海外" && text.includes(p)) ?? null;
}

// ---------------------------------------------------------------
// 型
// ---------------------------------------------------------------
export interface BasisRule {
  id: string;
  family: string;
  prefecture?: string;
  delta: number;
  reason: string; // 画面・コメントに出す短文（例: 受注実績 飲食 5件）
  n: number;
}

export interface ScoringBasis {
  day: string;
  computedAt: string;
  windowDays: number;
  wins: {
    total: number; // 受注した社数（同じ会社は1）
    deals: number; // 受注商談の件数
    byFamily: Record<string, number>;
    byFamilyInferred: Record<string, number>; // 家族ごとの「推定で入れた社数」
    byFamilyPref: Record<string, number>; // "家族|県"
    byPref: Record<string, number>;
    unclassified: number; // 推定しても家族が付かなかった社数
    closingFactors: string[]; // 決め手（直近5件・60字まで）
  };
  outreach: {
    total: number;
    byFamily: Record<string, { sent: number; replied: number; noReply: number; rejected: number }>;
  };
  decisions: {
    byFamily: Record<string, { success: number; skipped: number }>;
  };
  rules: BasisRule[];
  /** 根拠不足で固定にした項目の説明（画面に出す） */
  fixed: string[];
}

export interface BasisApplied {
  delta: number;
  reasons: string[];
}

// ---------------------------------------------------------------
// 組み立て
// ---------------------------------------------------------------
function jstDayKey(d = new Date()): string {
  const jst = new Date(d.getTime() + 9 * 3600_000);
  return jst.toISOString().slice(0, 10);
}

export async function buildScoringBasis(now = new Date()): Promise<ScoringBasis> {
  const since = new Date(now.getTime() - BASIS_WINDOW_DAYS * 86400_000);

  const [won, outreach, successLeads, skippedLeads] = await Promise.all([
    db.deal.findMany({
      // 受注日（closedAt）で窓を切る。closedAt が無い古い記録だけ updatedAt で代用
      where: {
        status: "CLOSED_WON",
        OR: [{ closedAt: { gte: since } }, { closedAt: null, updatedAt: { gte: since } }],
      },
      // amount は取らない（判定基準に金額は使わない）
      select: { title: true, closingFactor: true, updatedAt: true, closedAt: true, customerId: true, customer: { select: { name: true, industry: true, prefecture: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.lead.findMany({
      where: { outreachResultAt: { gte: since }, outreachResult: { not: null } },
      select: { industry: true, outreachResult: true },
    }),
    db.lead.groupBy({
      by: ["industry"],
      where: { status: { in: ["APPOINTMENT", "DEAL_CONVERTED"] }, scoreTotal: { gt: 0 } },
      _count: { _all: true },
    }),
    db.lead.groupBy({
      by: ["industry"],
      where: { status: "SKIPPED", scoreTotal: { gt: 0 }, updatedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const bump = (m: Record<string, number>, k: string, by = 1) => {
    m[k] = (m[k] ?? 0) + by;
  };

  // 受注: 同じ会社の複数商談は1社として数える（「どの業種が決まりやすいか」は社数で見る）。deals には商談数を残す
  const wins: ScoringBasis["wins"] = { total: 0, deals: won.length, byFamily: {}, byFamilyInferred: {}, byFamilyPref: {}, byPref: {}, unclassified: 0, closingFactors: [] };
  // 同名の顧客レコードが複数あることがある（例: 観光協会が2件）ので、社名の正規化で同一視する
  const seenCustomer = new Set<string>();
  for (const d of won) {
    const cf = (d.closingFactor ?? "").trim();
    if (cf && wins.closingFactors.length < 5) wins.closingFactors.push(cf.slice(0, 60));
    const key = normalizeCompanyName(d.customer.name) || d.customerId;
    if (seenCustomer.has(key)) continue;
    seenCustomer.add(key);
    wins.total++;
    const { family: fam, inferred } = familyForCustomer(d.customer.industry, d.customer.name, d.title);
    if (fam === "その他") wins.unclassified++;
    if (inferred) bump(wins.byFamilyInferred, fam);
    const pref = prefectureIn(d.customer.prefecture);
    bump(wins.byFamily, fam);
    if (pref) {
      bump(wins.byPref, pref);
      bump(wins.byFamilyPref, `${fam}|${pref}`);
    }
  }

  // 送付結果
  const outreachStat: ScoringBasis["outreach"] = { total: outreach.length, byFamily: {} };
  for (const l of outreach) {
    const fam = industryFamily(l.industry);
    const s = (outreachStat.byFamily[fam] ??= { sent: 0, replied: 0, noReply: 0, rejected: 0 });
    s.sent++;
    if (l.outreachResult === "REPLIED" || l.outreachResult === "WON") s.replied++;
    else if (l.outreachResult === "NO_REPLY") s.noReply++;
    else s.rejected++;
  }

  // 判断（アポ/商談化 vs スキップ）
  const decisions: ScoringBasis["decisions"] = { byFamily: {} };
  for (const r of successLeads) {
    const fam = industryFamily(r.industry);
    (decisions.byFamily[fam] ??= { success: 0, skipped: 0 }).success += r._count._all;
  }
  for (const r of skippedLeads) {
    const fam = industryFamily(r.industry);
    (decisions.byFamily[fam] ??= { success: 0, skipped: 0 }).skipped += r._count._all;
  }

  // ルール化（閾値に届いたものだけ）
  const rules: BasisRule[] = [];
  const fixed: string[] = [];

  const inf = (fam: string) => (wins.byFamilyInferred[fam] ? `・うち推定${wins.byFamilyInferred[fam]}` : "");
  for (const [fam, n] of Object.entries(wins.byFamily)) {
    if (fam === "その他") continue;
    if (n >= 8) rules.push({ id: `win:${fam}`, family: fam, delta: 5, reason: `受注実績 ${fam} ${n}社${inf(fam)}`, n });
    else if (n >= 3) rules.push({ id: `win:${fam}`, family: fam, delta: 3, reason: `受注実績 ${fam} ${n}社${inf(fam)}`, n });
    else fixed.push(`受注 ${fam} ${n}社${inf(fam)}（3社未満のため固定）`);
  }
  if (wins.unclassified) fixed.push(`業種を推定できなかった受注 ${wins.unclassified}社（顧客管理の業種が入れば反映）`);
  for (const [key, n] of Object.entries(wins.byFamilyPref)) {
    const [fam, pref] = key.split("|");
    if (fam === "その他" || n < 2) continue;
    rules.push({ id: `winpref:${key}`, family: fam, prefecture: pref, delta: 2, reason: `受注実績 ${fam}×${pref} ${n}社`, n });
  }
  for (const [fam, s] of Object.entries(outreachStat.byFamily)) {
    if (fam === "その他") continue;
    if (s.sent < 10) {
      fixed.push(`送付結果 ${fam} ${s.sent}件（10件未満のため固定）`);
      continue;
    }
    const rate = s.replied / s.sent;
    if (rate >= 0.2) rules.push({ id: `reply:${fam}`, family: fam, delta: 3, reason: `返信率 ${fam} ${Math.round(rate * 100)}%（${s.sent}件）`, n: s.sent });
    else if (s.replied === 0) rules.push({ id: `noreply:${fam}`, family: fam, delta: -3, reason: `無反応 ${fam} ${s.sent}件で返信0`, n: s.sent });
  }
  for (const [fam, s] of Object.entries(decisions.byFamily)) {
    if (fam === "その他") continue;
    const total = s.success + s.skipped;
    if (total < 10 || s.success === 0) continue;
    const rate = s.success / total;
    if (rate >= 0.15) rules.push({ id: `decide:${fam}`, family: fam, delta: 2, reason: `アポ/商談化率 ${fam} ${Math.round(rate * 100)}%（${total}件）`, n: total });
  }

  return {
    day: jstDayKey(now),
    computedAt: now.toISOString(),
    windowDays: BASIS_WINDOW_DAYS,
    wins,
    outreach: outreachStat,
    decisions,
    rules,
    fixed,
  };
}

export function summarizeBasis(b: ScoringBasis): string {
  const top = Object.entries(b.wins.byFamily).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([f, n]) => `${f} ${n}`).join("・");
  return [
    `受注 ${b.wins.total}社・${b.wins.deals}件（${top || "—"}）／送付結果 ${b.outreach.total}件／効いている補正 ${b.rules.length}本`,
    b.rules.length ? b.rules.slice(0, 4).map((r) => `${r.delta > 0 ? "+" : ""}${r.delta} ${r.reason}`).join("、") : "補正なし（根拠不足のため素点のまま）",
  ].join("\n");
}

// ---------------------------------------------------------------
// 1日1回の取得（無ければ組み立てて保存）
// ---------------------------------------------------------------
export async function getTodayScoringBasis(): Promise<ScoringBasis> {
  const day = jstDayKey();
  const row = await db.leadScoringBasis.findUnique({ where: { day } }).catch(() => null);
  if (row) return row.data as unknown as ScoringBasis;
  const basis = await buildScoringBasis();
  await db.leadScoringBasis
    .upsert({
      where: { day },
      create: { day, data: basis as unknown as Prisma.InputJsonValue, summary: summarizeBasis(basis), ruleCount: basis.rules.length },
      update: {},
    })
    .catch((e) => console.error("[scoring-basis] save failed:", e instanceof Error ? e.message : e));
  return basis;
}

/** 直近N日の基準（画面の「昨日と何が変わったか」に使う） */
export async function getRecentBases(days = 7) {
  return db.leadScoringBasis.findMany({ orderBy: { day: "desc" }, take: days, select: { day: true, summary: true, ruleCount: true, computedAt: true } });
}

// ---------------------------------------------------------------
// 適用
// ---------------------------------------------------------------
export function applyBasis(basis: ScoringBasis, industryInput: string, areaText?: string | null): BasisApplied {
  const fam = industryFamily(industryInput);
  const pref = prefectureIn(areaText);
  const hit = basis.rules.filter((r) => r.family === fam && (!r.prefecture || r.prefecture === pref));
  const raw = hit.reduce((s, r) => s + r.delta, 0);
  const delta = Math.max(BASIS_MIN_DELTA, Math.min(BASIS_MAX_DELTA, raw));
  return { delta, reasons: hit.map((r) => `${r.delta > 0 ? "+" : ""}${r.delta} ${r.reason}`) };
}

/** AIの素点に補正を掛ける。breakdown に basisAdjust を残し、コメント末尾に理由を1行足す */
export function adjustScores<T extends { total: number; breakdown: Record<string, number>; comment: string }>(
  scores: T[],
  applied: BasisApplied,
): T[] {
  if (applied.delta === 0) return scores;
  const suffix = `｜今日の基準 ${applied.delta > 0 ? "+" : ""}${applied.delta}（${applied.reasons.join("・")}）`;
  return scores.map((s) => ({
    ...s,
    total: Math.max(0, Math.min(100, Math.round(s.total + applied.delta))),
    breakdown: { ...s.breakdown, basisAdjust: applied.delta },
    comment: `${s.comment}${suffix}`,
  }));
}

/** プロンプトに添える短文（コメントの文脈用。数点の加減は code 側で行うので AI には「参考」として渡す） */
export function basisPromptText(basis: ScoringBasis, industryInput: string, areaText?: string | null): string {
  const fam = industryFamily(industryInput);
  const pref = prefectureIn(areaText);
  const lines: string[] = [];
  const w = basis.wins.byFamily[fam] ?? 0;
  if (w) lines.push(`- 同じ業種（${fam}）で直近${basis.windowDays}日に${w}社から受注している${pref && basis.wins.byFamilyPref[`${fam}|${pref}`] ? `（うち${pref} ${basis.wins.byFamilyPref[`${fam}|${pref}`]}社）` : ""}`);
  const o = basis.outreach.byFamily[fam];
  if (o && o.sent >= 5) lines.push(`- 同じ業種への送付 ${o.sent}件: 返信あり${o.replied}・無反応${o.noReply}・断り${o.rejected}`);
  if (basis.wins.closingFactors.length) lines.push(`- 最近の受注の決め手: ${basis.wins.closingFactors.slice(0, 3).join("／")}`);
  if (!lines.length) return "";
  return `【今日の判定基準（${basis.day}・実績から自動生成）】\n${lines.join("\n")}\n※ 加減点は別途システムが行う。ここではコメントの切り口（何が決まりやすいか）に使う`;
}
