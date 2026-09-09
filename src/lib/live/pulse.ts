// ==============================================================
// グループライブ「脈」— OSを使う・AIに聞く・OSが自動で見つける・お客様が見る、を随時フィードに流す
//   （2026-09-09 代表指示「使う・探る・書くが随時反映されると、みんな自分も動こうとなる」）
//   材料は全部、既に残っている記録から組む。作った動きは流さない。
//     ai    : AI ACTIVITY FEED（別枠）＝AI連携（MCP／アーチくん）の呼び出しと提案書AI等。匿名・県なし＝「AIが動いている」ことだけ
//     auto  : OSの自動検知（買う気配のシグナル・補助金の新着・TVer案件プールの新着）→ 本体フィード
//     visit : お客様側（LPの閲覧・LINE友だち追加）→ 本体フィード（匿名）
//   ⚠️ 金額・自由記述は出さない。AI呼び出しの引数は「市・業種」だけ拾う。相手先名は出さない。
//   ⚠️ 9/9 代表指示: AIの動きは別枠・匿名・県も出さない。OS利用（ログイン等）は流さない。お客様側の行は「代表」（名前・社名なし）
//   同じ人の同じ動きは短時間で1行に畳む（ログイン=3時間・AI読み取り=15分・探索=10分）
// ==============================================================

import { db } from "@/lib/db";
import { SIGNAL_KIND_LABEL, type SignalKind } from "@/lib/leads/signal";

export type PulseKind = "auto" | "visit";
export interface PulseEvent {
  at: string;
  kind: PulseKind;
  actor: string;
  prefs: string[];
  text: string;
}
/** AI ACTIVITY FEED の1行＝時刻と文だけ（誰が・どの県かは持たない） */
export interface AiPulse {
  at: string;
  text: string;
}

const DAY_MS = 86_400_000;
const PREFS = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];
const prefsIn = (t: string | null | undefined) => (t ? PREFS.filter((p) => t.includes(p)) : []);

/** AIツール名 → 一行 */
const AI_TOOL_TEXT: Record<string, (args: Record<string, unknown>) => string> = {
  plan_campaign: (a) => `AIに「${[a.prefecture, a.city].filter(Boolean).join("")}×${a.industry ?? "業種"}」の営業計画を出させた`,
  prepare_outreach: () => "AIが営業メールを下書きにした（送るのは本人）",
  create_landing_page: (a) => `AIで${[a.prefecture, a.city, a.industry].filter(Boolean).join("・") || "業種×市"}のLPを作った`,
  draft_proposal: () => "AIで提案書の材料を束ねた",
  find_similar_wins: (a) => `AIで${a.industry ? `${a.industry}の` : ""}勝ち筋を引いた`,
  my_next_actions: () => "AIに「今日何する？」と聞いた",
  log_activity: () => "AIで営業のやり取りを記録した",
  create_customer: () => "AIで顧客を登録した",
  update_customer: () => "AIで顧客情報を更新した",
  create_deal: () => "AIで商談を起こした",
  update_deal: () => "AIで商談を更新した",
  set_closing_factor: () => "AIで受注の決め手を残した",
  create_lead: () => "AIでリードを登録した",
  discover_leads: (a) => `AIが${[a.prefecture, a.city].filter(Boolean).join("")}の${a.industry ?? "企業"}を新しく探して採点した`,
  record_lead_result: () => "AIでリードの結果を記録した",
  create_local_ad: (a) => `AIで${[a.prefecture, a.city].filter(Boolean).join("")}の地域限定広告を組んだ`,
  tver_area_plan: (a) => `AIで${[a.prefecture, a.city].filter(Boolean).join("")}のTVerプランを引いた`,
  search_wiki: () => "AIでWikiを調べた",
  get_wiki: () => "AIでWikiを読んだ",
  list_wiki: () => "AIでWikiを読んだ",
};
const AI_READ_GENERIC = "AIでOSの顧客・商談を読んだ";

/** OSの機能キー（api_usage_logs.feature）→ 一行 */
function usageText(feature: string): string | null {
  if (/^leads\/.*search$|^leads\/search$/.test(feature)) return "リードを探索した";
  if (/score$/.test(feature)) return "リードをAIで採点した";
  if (feature === "outreach/draft" || feature === "leads/draft") return "営業文面をAIで作った";
  if (feature === "leads/advise") return "AIに営業の助言を求めた";
  if (feature === "proposals/generate") return "提案書AIを動かした";
  if (feature === "strategy-advisor") return "提案戦略アドバイザーを使った";
  if (feature === "customers-enrich" || /enrich$/.test(feature)) return "会社情報をAIで補完した";
  if (feature === "chatbot") return "アーチくんに聞いた";
  if (feature.startsWith("studio/")) return "制作OSでAIを使った";
  if (feature === "cutsheet") return "カット表をAIで作った";
  return null;
}

/** 畳む間隔（ミリ秒）。無いものは畳まない */
const FOLD_MS: Record<string, number> = { mcp_os_read: 15 * 60_000, brand_kit_mcp: 15 * 60_000, usage: 10 * 60_000 };

interface Who { actor: string; prefs: string[] }

export async function buildPulseEvents(opts: { days?: number } = {}): Promise<{ events: PulseEvent[]; ai: AiPulse[] }> {
  const since = new Date(Date.now() - (opts.days ?? 7) * DAY_MS);
  const [audits, usages, signals, subsidies, tvcm, lps, lineFriends] = await Promise.all([
    db.auditLog.findMany({
      where: { createdAt: { gte: since }, action: { in: ["mcp_os_read", "mcp_os_write", "brand_kit_mcp", "mcp_connected"] } },
      orderBy: { createdAt: "desc" },
      take: 600,
      select: { action: true, email: true, entityId: true, detail: true, createdAt: true },
    }),
    db.apiUsageLog.findMany({ where: { createdAt: { gte: since }, feature: { in: ["chatbot", "proposals/generate", "outreach/draft", "leads/draft", "leads/advise", "strategy-advisor"] } }, orderBy: { createdAt: "desc" }, take: 300, select: { email: true, feature: true, createdAt: true } }),
    db.lead.findMany({
      where: { signalAt: { gte: since }, signalKind: { notIn: ["MANUAL", "FOUND"] }, status: { notIn: ["SKIPPED", "ARCHIVED"] } },
      orderBy: { signalAt: "desc" },
      take: 300,
      select: { signalAt: true, signalKind: true, prefecture: true, area: true, industry: true },
    }),
    db.subsidy.findMany({ where: { createdAt: { gte: since }, isActive: true, adCostFit: "CONFIRMED" }, orderBy: { createdAt: "desc" }, take: 60, select: { title: true, targetAreas: true, createdAt: true, adCostFit: true } }),
    db.lead.findMany({ where: { createdAt: { gte: since }, source: "PR_TIMES_TVCM" }, orderBy: { createdAt: "desc" }, take: 200, select: { createdAt: true, prefecture: true } }),
    db.landingPage.findMany({ where: { updatedAt: { gte: since }, views: { gt: 0 }, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, take: 40, select: { title: true, industry: true, prefecture: true, cityName: true, views: true, updatedAt: true, groupCompanyId: true } }),
    db.lineFriend.findMany({ where: { followedAt: { gte: since }, isFollowing: true }, orderBy: { followedAt: "desc" }, take: 200, select: { followedAt: true, account: { select: { name: true, branch: { select: { name: true } } } } } }),
  ]);

  // 人 → 拠点名・県（メールで引く）
  const emails = [...new Set([...audits.map((a) => a.email), ...usages.map((u) => u.email)])].filter((e) => e && e !== "demo@adarch.co.jp" && e !== "arch-kun@adarch.co.jp");
  const users = emails.length
    ? await db.user.findMany({ where: { email: { in: emails } }, select: { email: true, name: true, role: true, branch: { select: { name: true } }, groupCompany: { select: { name: true, prefecture: true } } } })
    : [];
  const whoOf = new Map<string, Who>();
  for (const u of users) {
    if (u.role !== "ADMIN" && !u.groupCompany && !u.branch) continue; // 拠点未割当は流さない
    // AI連携・OS利用の行は匿名（2026-09-09 代表指示「赤裸々すぎる」）＝名前・社名を出さず「代表」。本部だけ「本部」。県は地図のために残す
    const actor = u.role === "ADMIN" ? "本部" : "代表";
    whoOf.set(u.email, { actor, prefs: [...new Set([...prefsIn(u.groupCompany?.prefecture), ...prefsIn(u.branch?.name)])] });
  }

  const events: PulseEvent[] = [];
  const lastAt = new Map<string, number>(); // 畳み用
  const fold = (key: string, at: Date, ms: number) => {
    const t = at.getTime();
    const prev = lastAt.get(key);
    if (prev !== undefined && prev - t < ms) return true; // 直前（新しい側）に同じものがある＝畳む
    lastAt.set(key, t);
    return false;
  };
  const parseArgs = (detail: string | null): Record<string, unknown> => {
    const m = /\{[\s\S]*\}$/.exec(detail ?? "");
    try { return m ? (JSON.parse(m[0]) as Record<string, unknown>) : {}; } catch { return {}; }
  };

  // ---- AI ACTIVITY FEED（匿名・県なし＝「AIが動いている」ことだけ） ----
  const ai: AiPulse[] = [];
  for (const a of audits) {
    const who = whoOf.get(a.email);
    if (!who) continue;
    const client = /^\[([^\]]+)\]/.exec(a.detail ?? "")?.[1];
    const via = client === "アーチくん" ? "アーチくん" : "AI";
    if (a.action === "mcp_connected") {
      if (fold(`${a.email}:connected`, a.createdAt, 60 * 60_000)) continue;
      ai.push({ at: a.createdAt.toISOString(), text: "新しくAIがOSにつながった" });
      continue;
    }
    if (a.action === "brand_kit_mcp") {
      if (fold(`${a.email}:kit`, a.createdAt, FOLD_MS.brand_kit_mcp)) continue;
      ai.push({ at: a.createdAt.toISOString(), text: `${via}がブランドキットを読んだ` });
      continue;
    }
    const tool = a.entityId ?? "";
    const fn = AI_TOOL_TEXT[tool];
    if (!fn && a.action === "mcp_os_read") {
      if (fold(`${a.email}:airead`, a.createdAt, FOLD_MS.mcp_os_read)) continue;
      ai.push({ at: a.createdAt.toISOString(), text: AI_READ_GENERIC.replace("AI", via) });
      continue;
    }
    const args = parseArgs(a.detail);
    const text = fn ? fn(args).replace(/^AI/, via) : `${via}でOSに書いた`;
    if (fold(`${a.email}:${tool}`, a.createdAt, 5 * 60_000)) continue;
    ai.push({ at: a.createdAt.toISOString(), text });
  }
  for (const u of usages) {
    const who = whoOf.get(u.email);
    const text = usageText(u.feature);
    if (!who || !text) continue;
    if (fold(`${u.email}:${text}`, u.createdAt, FOLD_MS.usage)) continue;
    ai.push({ at: u.createdAt.toISOString(), text });
  }
  ai.sort((x, y) => y.at.localeCompare(x.at));

  // ---- 自動検知: シグナル（県×日で束ねる） ----
  const sigGroups = new Map<string, { at: Date; n: number; kinds: Set<string>; prefs: string[] }>();
  for (const l of signals) {
    if (!l.signalAt) continue;
    const prefs = prefsIn(l.prefecture ?? l.area);
    const day = l.signalAt.toISOString().slice(0, 10);
    const key = `${prefs[0] ?? "全国"}:${day}`;
    const g = sigGroups.get(key) ?? { at: l.signalAt, n: 0, kinds: new Set<string>(), prefs };
    g.n += 1;
    g.kinds.add(SIGNAL_KIND_LABEL[l.signalKind as SignalKind] ?? l.signalKind ?? "気配");
    if (l.signalAt > g.at) g.at = l.signalAt;
    sigGroups.set(key, g);
  }
  for (const [key, g] of sigGroups) {
    const pref = key.split(":")[0];
    events.push({ at: g.at.toISOString(), kind: "auto", actor: "OSが検知", prefs: g.prefs, text: `${pref === "全国" ? "" : `${pref}で`}買う気配を${g.n}社に検知（${[...g.kinds].slice(0, 3).join("・")}）` });
  }
  // ---- 自動検知: 補助金・TVer案件プール ----
  for (const s of subsidies) {
    const prefs = s.targetAreas.flatMap((t) => prefsIn(t));
    events.push({ at: s.createdAt.toISOString(), kind: "auto", actor: "補助金ファインダー", prefs, text: `広告費に使える補助金が新着${prefs.length ? `（${prefs.slice(0, 2).join("・")}）` : "（全国）"}: ${s.title.slice(0, 28)}` });
  }
  const tvGroups = new Map<string, { at: Date; n: number; prefs: Set<string> }>();
  for (const l of tvcm) {
    const day = l.createdAt.toISOString().slice(0, 10);
    const g = tvGroups.get(day) ?? { at: l.createdAt, n: 0, prefs: new Set<string>() };
    g.n += 1;
    prefsIn(l.prefecture).forEach((p) => g.prefs.add(p));
    if (l.createdAt > g.at) g.at = l.createdAt;
    tvGroups.set(day, g);
  }
  for (const g of tvGroups.values()) events.push({ at: g.at.toISOString(), kind: "auto", actor: "TVer案件プール", prefs: [...g.prefs], text: `テレビCM出稿企業の新着 ${g.n}件（先着で取れます）` });

  // ---- お客様側: LP閲覧・LINE友だち ----
  const lpCompanyIds = [...new Set(lps.map((p) => p.groupCompanyId).filter((x): x is string => !!x))];
  const lpCompanies = lpCompanyIds.length ? await db.groupCompany.findMany({ where: { id: { in: lpCompanyIds } }, select: { id: true, name: true } }) : [];
  const lpCompanyName = new Map(lpCompanies.map((c) => [c.id, c.name]));
  for (const p of lps) {
    const actor = p.groupCompanyId && lpCompanyName.has(p.groupCompanyId) ? "代表" : "本部"; // 匿名
    events.push({ at: p.updatedAt.toISOString(), kind: "visit", actor, prefs: prefsIn(p.prefecture), text: `${[p.cityName, p.industry].filter(Boolean).join("×") || "営業用"}のLPが読まれた（累計${p.views}回）` });
  }
  const lfGroups = new Map<string, { at: Date; n: number; actor: string; prefs: string[] }>();
  for (const f of lineFriends) {
    const branch = f.account.branch?.name ?? null;
    const actor = branch ? "代表" : "本部"; // 匿名（どの拠点かは県の光り方だけ）
    const key = `${branch ?? "hq"}:${f.followedAt.toISOString().slice(0, 13)}`; // 拠点×時間で束ねる
    const g = lfGroups.get(key) ?? { at: f.followedAt, n: 0, actor, prefs: prefsIn(branch) };
    g.n += 1;
    if (f.followedAt > g.at) g.at = f.followedAt;
    lfGroups.set(key, g);
  }
  for (const g of lfGroups.values()) events.push({ at: g.at.toISOString(), kind: "visit", actor: g.actor, prefs: g.prefs, text: `LINE公式の友だちが${g.n}人増えた` });

  return { events, ai };
}
