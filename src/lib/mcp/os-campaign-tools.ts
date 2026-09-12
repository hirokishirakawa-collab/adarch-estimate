// ==============================================================
// MCP: 市×業界で「まとめて当たる」ツール（2026-09-09 代表指示＝営業の効率化）
//   plan_campaign        : 市×業種 → OSのリード・シグナル・周年・補助金・勝ち筋・送付済み台帳を読み、
//                          「当たりやすい順」＋訴求の型＋着地URL（TVer申込ページ／公式LINE／LP）を1コールで返す
//   prepare_outreach     : AIが書いた件名・本文を Gmail の下書きリンクにし、OSの送付フローと同じ記録を残す
//                          （送付台帳・リードの送付日・事例DBの元）。送信ボタンは人が押す（8/17 代表決定＝無人送信はしない）
//   create_landing_page  : 業種×市の営業用LP（/lp/<slug>）をAIの文面で作る。数字は表示時にOSから引く
//   list_landing_pages   : 自拠点／全社のLP一覧
// ==============================================================

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { stripSensitiveLines } from "@/lib/brand-kit/common";
import { normalizeDomain } from "@/lib/auto-sales-domain";
import { appUrl } from "@/lib/tver-order/service";
import { addFriendUrl } from "@/lib/line/format";
import { estimateArea, municipalitiesOf, prefectureOptions } from "@/lib/packages/tver-area";
import { nextAnniversary } from "@/lib/anniversary/calc";
import { FORM_SENT } from "@/lib/leads/apply-outreach-result";
import { canSeeAmount, type McpViewer } from "./os-read-tools";
import { WriteError, AI_PREFIX } from "./os-write-tools";
import { findSimilarWins } from "./os-insight-tools";

const DAY_MS = 86_400_000;
/** 会社メモの企業タイプ（buildPlaceLeadMemo が書く文言）。チェーン・FC・支店を見分ける */
const CHAIN_MEMO = /(チェーン店|フランチャイズ|支店・店舗)/;
/** 同じ相手に自拠点から送り直すまでの間隔。1か月ルール（本部の決まり） */
const RESEND_GUARD_DAYS = 30;
// 日付は日本時間で出す（toISOString だとUTCになり、JSTの0時は前日に見えてしまう）
const day = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : null;
const prefBase = (s: string) => (s.startsWith("北海道") ? "北海道" : s.trim().replace(/[都府県]$/, ""));
const clampLimit = (n: number | undefined, def = 20, max = 50) => Math.min(max, Math.max(1, Math.floor(n ?? def)));
function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new WriteError(msg);
}

/** 県名の揺れ（「佐賀」「佐賀県」）を正式名に */
export function resolvePref(input: string | undefined): string | null {
  if (!input) return null;
  const prefs = prefectureOptions();
  const t = input.trim();
  return prefs.find((p) => p === t) ?? prefs.find((p) => prefBase(p) === prefBase(t)) ?? null;
}
export function resolveCity(pref: string, input: string | undefined) {
  if (!input) return null;
  const munis = municipalitiesOf(pref);
  const t = input.trim();
  return munis.find((m) => m.name === t || m.code === t) ?? munis.find((m) => m.name.startsWith(t)) ?? null;
}

/** 自拠点の公式LINE（接続済み）の友だち追加URL */
async function lineFriendUrl(v: McpViewer): Promise<string | null> {
  if (!v.branchId) return null;
  const acc = await db.lineAccount.findFirst({ where: { branchId: v.branchId, isActive: true }, select: { basicId: true } });
  return addFriendUrl(acc?.basicId);
}

// ---- 営業計画 ---------------------------------------------------------------------

export interface PlanCampaignInput {
  prefecture: string;
  city?: string;
  industry: string;
  packageSlug?: string;
  limit?: number;
}

export async function planCampaign(v: McpViewer, input: PlanCampaignInput) {
  const pref = resolvePref(input.prefecture);
  need(pref, `都道府県名が一致しません（例: 佐賀県）。候補: ${prefectureOptions().slice(0, 6).join("、")} …`);
  const industry = input.industry?.trim();
  need(industry, "業種（industry）を入れてください。例: 歯科 / 工務店 / 飲食");
  const city = resolveCity(pref, input.city);
  need(!input.city || city, `市区町村が見つかりません。${pref}の候補: ${municipalitiesOf(pref).slice(0, 20).map((m) => m.name).join("、")} …`);
  const take = clampLimit(input.limit);
  const now = new Date();
  const base = prefBase(pref);

  // 候補: 生きているリードで、この県（＋市）・この業種。担当は自分か空き。送付済みは除く
  const where: Prisma.LeadWhereInput = {
    status: { notIn: ["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"] },
    OR: [{ prefecture: { contains: base } }, { area: { contains: base } }, { address: { contains: base } }],
    AND: [
      { OR: [{ industry: { contains: industry, mode: "insensitive" } }, { name: { contains: industry, mode: "insensitive" } }] },
      { OR: [{ assigneeId: null }, { assigneeId: v.id }] },
      ...(city ? [{ OR: [{ area: { contains: city.name } }, { address: { contains: city.name } }] }] : []),
    ],
  };
  const [leads, blacklist, subsidies, pkgs, wins, line] = await Promise.all([
    db.lead.findMany({
      where,
      take: 200,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, industry: true, area: true, prefecture: true, address: true, email: true, phone: true, websiteUrl: true, scoreTotal: true, scoreComment: true, signalKind: true, signalAt: true, foundedYear: true, foundedMonth: true, sentAt: true, outreachResult: true, status: true, assigneeId: true, memo: true },
    }),
    db.autoSalesBlacklist.findMany({ select: { domain: true } }),
    db.subsidy.findMany({
      where: { isActive: true, adCostFit: { in: ["CONFIRMED", "LIKELY"] }, targetAreas: { hasSome: [pref, "全国"] }, AND: [{ OR: [{ acceptanceEnd: null }, { acceptanceEnd: { gte: now } }] }] },
      orderBy: [{ acceptanceEnd: "asc" }],
      take: 5,
      select: { id: true, title: true, institutionName: true, industry: true, acceptanceEnd: true, fitReason: true, detailUrl: true },
    }),
    db.salesPackage.findMany({ where: { status: "ACTIVE" }, select: { slug: true, name: true, tagline: true, targetIndustries: true, calculator: true } }),
    findSimilarWins(v, { industry, prefecture: pref, packageSlug: input.packageSlug, limit: 5 }),
    lineFriendUrl(v),
  ]);

  // 送付済み台帳（全社）とお断りリストで除外
  const domains = leads.map((l) => normalizeDomain(l.websiteUrl ?? "")).filter((d): d is string => !!d);
  const sent = domains.length ? await db.autoSalesSentDomain.findMany({ where: { domain: { in: domains } }, select: { domain: true, branch: { select: { name: true } }, sentAt: true } }) : [];
  const sentMap = new Map(sent.map((s) => [s.domain, s]));
  const blocked = new Set(blacklist.map((b) => normalizeDomain(b.domain) ?? b.domain));

  const scored = leads
    .map((l) => {
      const dom = normalizeDomain(l.websiteUrl ?? "");
      const reasons: string[] = [];
      let score = 0;
      if (dom && blocked.has(dom)) return null; // 営業お断り
      const sentBy = dom ? sentMap.get(dom) : undefined;
      if (l.sentAt || sentBy) return { l, skip: `送付済み（${sentBy?.branch.name ?? "自拠点"}・${day(sentBy?.sentAt ?? l.sentAt)}）` };
      // チェーン・FC・支店は本部決裁＝市の商圏で話が通らない。発掘時に外しているが、
      // 以前から入っているリードは会社メモの判定で下げる
      if (CHAIN_MEMO.test(l.memo ?? "")) return { l, skip: "チェーン・FC・支店（本部決裁のため市の商圏で話が通らない）" };
      if (l.signalAt && now.getTime() - l.signalAt.getTime() < 7 * DAY_MS) { score += 30; reasons.push(`今週シグナル: ${l.signalKind ?? "あり"}`); }
      const a = l.foundedYear ? nextAnniversary(l.foundedYear, l.foundedMonth ?? null, now) : null;
      if (a && a.monthsAway <= 3) { score += 20; reasons.push(`${a.years}周年が${a.monthsAway}か月後`); }
      else if (a && a.monthsAway <= 6) { score += 8; reasons.push(`${a.years}周年が${a.monthsAway}か月後`); }
      if (l.scoreTotal) { score += Math.min(20, Math.round(l.scoreTotal / 5)); reasons.push(`AIスコア ${l.scoreTotal}`); }
      if (l.email) { score += 10; reasons.push("メールあり"); } else if (l.websiteUrl) { score += 4; reasons.push("フォーム経由"); } else if (l.phone) { reasons.push("電話のみ"); } else { score -= 20; reasons.push("連絡手段なし"); }
      if (l.assigneeId === v.id) { score += 3; reasons.push("自分の担当"); }
      return { l, score, reasons };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const ranked = scored.filter((x): x is { l: (typeof leads)[number]; score: number; reasons: string[] } => "score" in x).sort((a, b) => b.score - a.score).slice(0, take);
  const skipped = scored.filter((x): x is { l: (typeof leads)[number]; skip: string } => "skip" in x).slice(0, 10);

  const tver = city ? estimateArea(pref, city.code) : null;
  const orderUrl = `${appUrl()}/order/tver?${new URLSearchParams({ ...(v.groupCompanyId ? { from: v.groupCompanyId } : {}), pref, ...(city ? { city: city.code } : {}) }).toString()}`;
  const lps = await db.landingPage.findMany({ where: { status: "PUBLISHED", OR: [{ industry: { contains: industry } }, { cityCode: city?.code ?? "__none__" }] }, orderBy: { createdAt: "desc" }, take: 5, select: { slug: true, title: true, industry: true, cityName: true } });
  const suggestedPackages = pkgs.filter((p) => p.targetIndustries.some((t) => t.includes(industry) || industry.includes(t))).slice(0, 4);

  return {
    target: { prefecture: pref, city: city?.name ?? null, industry, package: input.packageSlug ?? null },
    counts: { candidates: leads.length, ranked: ranked.length, alreadySent: skipped.length },
    order: "上から順に当たる。reasons が「なぜ今か」。連絡手段なしは電話か訪問",
    targets: ranked.map((x, i) => ({
      rank: i + 1, leadId: x.l.id, name: x.l.name, industry: x.l.industry, area: x.l.area ?? x.l.prefecture, address: x.l.address,
      email: x.l.email, phone: x.l.phone, website: x.l.websiteUrl, status: x.l.status, mine: x.l.assigneeId === v.id,
      score: x.score, reasons: x.reasons, memo: stripSensitiveLines(x.l.memo ?? "") || null, aiComment: x.l.scoreComment,
    })),
    alreadySent: skipped.map((x) => ({ leadId: x.l.id, name: x.l.name, note: x.skip })),
    pitch: {
      wins: wins.wins.slice(0, 3).map((w) => ({ industry: w.industry, prefecture: w.prefecture, closingFactor: w.closingFactor })),
      messagesThatGotReplies: wins.approaches.slice(0, 3).map((a) => ({ industry: a.industry, method: a.method, result: a.result, message: a.message, learnings: a.learnings })),
      suggestedPackages: suggestedPackages.map((p) => ({ slug: p.slug, name: p.name, tagline: p.tagline })),
      fundingOptions: subsidies.map((s) => ({ title: s.title, institution: s.institutionName, industry: s.industry, acceptanceEnd: day(s.acceptanceEnd), why: s.fitReason, url: s.detailUrl })),
    },
    landing: {
      tverOrderUrl: orderUrl,
      tverPlan: tver ? { area: tver.plan.areaLabel, viewers: Math.round(tver.plan.viewers), reach: Math.round(tver.plan.reach), monthlyExclTax: `¥${Math.round(tver.plan.monthly).toLocaleString("ja-JP")}`, note: "税抜・推計。正本はOSのシミュレーター" } : null,
      lineFriendUrl: line,
      landingPages: lps.map((p) => ({ url: `${appUrl()}/lp/${p.slug}`, title: p.title, industry: p.industry, city: p.cityName })),
      howTo: "業種×市のLPを作るなら create_landing_page。着地は tverOrderUrl（申込まで完結）か lineFriendUrl（関係づくり）",
    },
    next: "1社ずつ件名と本文を書き、prepare_outreach(leadId, subject, body) で Gmail の下書きにする。送信ボタンは人が押す。返事が来たら record_lead_result",
  };
}

// ---- 送付の準備（Gmailの下書き＋OSの送付記録） -----------------------------------------------

export interface PrepareOutreachInput {
  leadId: string;
  subject: string;
  body: string;
  appeal?: string;
  packageSlug?: string;
  /** 1か月ルールを承知のうえで送り直す（人が判断したときだけ） */
  resend?: boolean;
}

export async function prepareOutreach(v: McpViewer, input: PrepareOutreachInput) {
  need(input.leadId, "leadId は必須です（plan_campaign / list_leads で探せます）");
  const subject = input.subject?.trim();
  const body = input.body?.trim();
  need(subject && subject.length <= 120, "件名（subject）は1〜120文字にしてください");
  need(body && body.length <= 4000, "本文（body）は1〜4000文字にしてください");
  need(!/[¥￥]\s?\d|\d+円/.test(body!), "本文に金額が入っています。金額は書かず、申込ページやプランの案内に留めてください");
  const lead = await db.lead.findUnique({ where: { id: input.leadId } });
  need(lead, "リードが見つかりません");
  need(lead.assigneeId === null || lead.assigneeId === v.id || v.role === "ADMIN", "このリードは別の担当者のものです");
  need(!["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"].includes(lead.status), "このリードは営業対象外（除外済み／商談化済み）です");

  // 自拠点が最近送った相手への送り直しを止める（1か月ルール）。他拠点の送付済みは下で見る
  if (lead.sentAt && !input.resend) {
    const days = Math.floor((Date.now() - lead.sentAt.getTime()) / DAY_MS);
    if (days < RESEND_GUARD_DAYS) {
      return {
        blocked: true,
        reason: `この会社には${day(lead.sentAt)}に送っています（${days}日前）。1か月あけてください${lead.outreachResult ? `。前回の結果: ${lead.outreachResult}` : "。返事はまだ記録されていません"}`,
        next: "どうしても今日送るなら resend: true。返事が来ていたなら record_lead_result(leadId, result)",
      };
    }
  }

  const domain = normalizeDomain(lead.websiteUrl ?? "");
  if (domain) {
    const blocked = await db.autoSalesBlacklist.findFirst({ where: { domain: { in: [domain, `https://${domain}`, `http://${domain}`] } }, select: { reason: true } });
    need(!blocked, `この会社は営業お断りリストに入っています${blocked?.reason ? `（${blocked.reason}）` : ""}。送らないでください`);
    const sentBy = await db.autoSalesSentDomain.findFirst({ where: { domain }, select: { branch: { select: { name: true } }, sentAt: true } });
    if (sentBy && !lead.sentAt) {
      return { blocked: true, reason: `この会社には ${sentBy.branch.name} が ${day(sentBy.sentAt)} に送付済みです（全社の送付台帳）。二重に当たらないため止めました` };
    }
  }
  need(lead.email || lead.websiteUrl, "メールもサイトも無い会社です。電話か訪問で当たってください（記録は log_activity）");

  const staffName = v.name ?? v.email;
  const packageId = input.packageSlug ? (await db.salesPackage.findUnique({ where: { slug: input.packageSlug }, select: { id: true } }))?.id ?? null : null;

  // 担当が空なら自分に
  if (lead.assigneeId === null) {
    await db.lead.update({ where: { id: lead.id }, data: { assigneeId: v.id } });
    await db.leadLog.create({ data: { leadId: lead.id, action: "ASSIGNED", detail: `${AI_PREFIX}送付の準備に合わせて担当に設定`, staffName } });
  }
  // 全社の送付台帳（OSの「送付済み」と同じ）
  if (domain && v.branchId) {
    await db.autoSalesSentDomain.create({ data: { domain, companyName: lead.name, branchId: v.branchId, source: "LEAD_FORM", sourceId: lead.id, sentBy: v.email } }).catch(() => null);
  }
  const detail = `${AI_PREFIX}【訴求】${(input.appeal ?? "").trim()}\n件名: ${subject}\n${body}`.slice(0, 8000);
  await db.leadLog.create({ data: { action: FORM_SENT, detail, staffName, leadId: lead.id, packageId } });
  const statusPatch = lead.status === "UNTOUCHED" ? { status: "CALLED" as const } : {};
  await db.lead.update({ where: { id: lead.id }, data: { sentAt: new Date(), outreachResult: null, outreachResultAt: null, ...statusPatch } });

  const params = new URLSearchParams({ view: "cm", fs: "1", su: subject!, body: body! });
  if (lead.email) params.set("to", lead.email);
  const gmailUrl = `https://mail.google.com/mail/?${params.toString()}`;
  return {
    leadId: lead.id, name: lead.name, to: lead.email, channel: lead.email ? "email" : "form",
    gmailDraftUrl: lead.email ? gmailUrl : null,
    formUrl: lead.email ? null : lead.websiteUrl,
    // メールが無い相手は、問い合わせフォームに人がそのまま貼れる形で返す（無人送信はしない）
    formPaste: lead.email
      ? null
      : {
          url: lead.websiteUrl,
          subject,
          body,
          senderName: staffName,
          steps: [
            "1) url を開いて問い合わせフォームを出す",
            "2) subject を『件名』、body を『お問い合わせ内容』に貼る",
            "3) 自社の会社名・担当者名・連絡先を埋めて、自分で送信ボタンを押す",
            "4) 送れない（画像認証・営業お断りの記載など）なら record_lead_result(leadId, phoneCandidate: true, note: 理由) で電話候補に回す",
          ],
          note: "AIが自動でフォームに投稿しない。送信は人が押す（本部の決まり）",
        },
    recorded: { sentAt: day(new Date()), sentLedger: !!domain, leadStatus: statusPatch.status ?? lead.status },
    next: lead.email
      ? "gmailDraftUrl を開いて、読んで、送信ボタンを押す。返事が来たら record_lead_result(leadId, result)"
      : "formPaste の steps の通りに人がフォームへ貼って送る。送れなければ電話候補に回す。返事が来たら record_lead_result(leadId, result)",
  };
}

// ---- 業種×市のLP --------------------------------------------------------------------------

export interface CreateLandingPageInput {
  title: string;
  headline: string;
  subheadline?: string;
  industry?: string;
  prefecture?: string;
  city?: string;
  packageSlug?: string;
  sections: { heading: string; body: string }[];
  ctaLabel?: string;
  ctaUrl?: string;
  useLine?: boolean;
  slug?: string;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export async function createLandingPage(v: McpViewer, input: CreateLandingPageInput) {
  need(input.title?.trim() && input.title.length <= 80, "title は1〜80文字");
  need(input.headline?.trim() && input.headline.length <= 60, "headline（大見出し）は1〜60文字");
  need(Array.isArray(input.sections) && input.sections.length >= 2 && input.sections.length <= 6, "sections は2〜6段落（{heading, body}）");
  for (const sec of input.sections) {
    need(sec.heading?.trim() && sec.heading.length <= 60, "各段落の heading は1〜60文字");
    need(sec.body?.trim() && sec.body.length <= 800, "各段落の body は1〜800文字");
    need(!/[¥￥]\s?\d|\d+円/.test(sec.body), "本文に金額を書かないでください。TVerの数字は showTverPlan でOSから自動表示されます");
  }
  const pref = input.prefecture ? resolvePref(input.prefecture) : null;
  need(!input.prefecture || pref, "都道府県名が一致しません（例: 佐賀県）");
  const city = pref && input.city ? resolveCity(pref, input.city) : null;
  need(!input.city || city, "市区町村が見つかりません");
  if (input.packageSlug) need(await db.salesPackage.findUnique({ where: { slug: input.packageSlug }, select: { id: true } }), "packageSlug が台帳にありません（list_packages）");
  const line = input.useLine ? await lineFriendUrl(v) : null;
  if (input.useLine) need(line, "貴社の公式LINEがOSに接続されていません（サイドバー「LINE公式」）");
  const ctaUrl = input.ctaUrl?.trim() || `${appUrl()}/order/tver?${new URLSearchParams({ ...(v.groupCompanyId ? { from: v.groupCompanyId } : {}), ...(pref ? { pref } : {}), ...(city ? { city: city.code } : {}) }).toString()}`;
  need(/^https?:\/\//.test(ctaUrl), "ctaUrl は https:// から始めてください");

  // slug は英数字だけ。AIが渡さない場合は「市区町村コード＋短い時刻」（日本語は落とす）
  const baseSlug = slugify(input.slug ?? "") || `lp-${city?.code ?? "all"}-${Date.now().toString(36).slice(-5)}`;
  let slug = baseSlug;
  for (let i = 2; await db.landingPage.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${baseSlug}-${i}`;

  const p = await db.landingPage.create({
    data: {
      slug, title: input.title.trim(), headline: input.headline.trim(), subheadline: input.subheadline?.trim() || null,
      industry: input.industry?.trim() || null, prefecture: pref, cityCode: city?.code ?? null, cityName: city?.name ?? null,
      packageSlug: input.packageSlug ?? null, sections: input.sections.map((s) => ({ heading: s.heading.trim(), body: s.body.trim() })),
      ctaLabel: input.ctaLabel?.trim() || "エリア限定プランを見る", ctaUrl, lineUrl: line, showTverPlan: !!city,
      branchId: v.branchId, groupCompanyId: v.groupCompanyId, createdByEmail: v.email, createdByName: v.name,
    },
    select: { id: true, slug: true, title: true },
  });
  return { id: p.id, slug: p.slug, url: `${appUrl()}/lp/${p.slug}`, title: p.title, next: "URLを営業メールに添える（prepare_outreach の本文に入れる）。数字は表示時にOSから引くので、文面に金額は不要" };
}

export async function listLandingPages(v: McpViewer, input: { mine?: boolean; limit?: number }) {
  const rows = await db.landingPage.findMany({
    where: { status: { not: "ARCHIVED" }, ...(input.mine && v.branchId ? { branchId: v.branchId } : {}) },
    orderBy: { createdAt: "desc" },
    take: clampLimit(input.limit, 20, 50),
    select: { slug: true, title: true, headline: true, industry: true, prefecture: true, cityName: true, packageSlug: true, views: true, createdByName: true, createdAt: true, branchId: true },
  });
  return rows.map((p) => ({ url: `${appUrl()}/lp/${p.slug}`, slug: p.slug, title: p.title, headline: p.headline, industry: p.industry, area: [p.prefecture, p.cityName].filter(Boolean).join(""), package: p.packageSlug, views: p.views, by: p.createdByName, createdAt: day(p.createdAt), isMine: p.branchId ? canSeeAmount(v, p.branchId) : false }));
}
