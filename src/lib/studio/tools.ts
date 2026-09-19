// ==============================================================
// Ad Arch Studio（公開MCP）のツール7本 — ログインなしで誰でも使える「相談窓口」（相手が望めば依頼も受ける・全国対応）
//   外から見える相手は常に「アドアーチ」。どの県本部が担当するかは返さない（振り分けは内部だけ）。
//   ⚠️ ここから OS のツール台帳（tool-catalog / os-read-tools / os-write-tools）やブランドキットは読み込まない。
//      DBを読むのは subsidy と、本部が公開の印を付けた sales_packages・自社の資料・Wiki記事だけ。書くのは studio_inquiries だけ。
//   ⚠️ 顧客・商談・売上・卸値・拠点の情報は返さない。価格はすべて「目安・税抜」
// ==============================================================

import { z } from "zod";
import { db } from "@/lib/db";
import { estimateArea, monthlyGuideText, municipalitiesOf, prefectureOptions, resolveArea } from "@/lib/packages/tver-area";
import { CUSTOM_DESIGN_FEE, CUSTOM_OPS_MIN, CUSTOM_OPS_RATE, TVER_ESTIMATE_NOTE } from "@/lib/tver/plan";
import { AD_AWARDS } from "@/lib/ad-award/curated";
import { entryWindow } from "@/lib/ad-award/calc";
import { AWARD_CATEGORIES } from "@/lib/ad-award/types";
import { SCOPE_META } from "@/lib/ad-award/options";
import { formatPackagePrice, parseDeliverables } from "@/lib/packages/types";
import { stripSensitiveLines } from "@/lib/brand-kit/common";
import { EMAIL_RE, looksLikeSales } from "@/lib/contact/guard";
import { cached, inquiryLimited } from "./guard";
import { normalizePrefecture, routeInquiry } from "./routing";
import { addBusinessMinutes, formatJst } from "./business-hours";
import { notifyNewInquiry } from "./notify";
import { STUDIO_KIND_LABEL, inquiryNumberLabel } from "./labels";

export const STUDIO_NAME = "アドアーチ（Ad Arch Studio）";
const PRICE_NOTE = "価格はすべて目安・税抜です。正式な金額は、アドアーチの担当がご用件を伺ってからお見積りします。";

export interface StudioCaller {
  ipHash: string;
  userAgent: string | null;
}

export interface StudioToolDef {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject;
  /** true＝問い合わせ（書き込み）。上限の数え方が違う */
  write?: boolean;
  run: (args: never, caller: StudioCaller) => Promise<unknown> | unknown;
}

const def = <A extends z.ZodObject>(d: { name: string; title: string; description: string; input: A; write?: boolean; run: (args: z.infer<A>, caller: StudioCaller) => Promise<unknown> | unknown }): StudioToolDef =>
  d as unknown as StudioToolDef;

function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "").replace(/\/$/, "");
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const trim = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null);

// ---------------- 1. TVer エリア別の見積 ----------------
function tverApplyUrl(pref: string, code?: string): string {
  const q = new URLSearchParams({ pref, ...(code ? { city: code } : {}) });
  return `${publicBaseUrl()}/order/tver?${q.toString()}`;
}

const TVER_RULES_PUBLIC = {
  cityPlan:
    "市町村プラン（Webで相談・申込できる型）: 1エリア・15秒・配信終了後に結果報告。人口5万人未満のエリアは「まちのプラン」月額¥30,000（6ヶ月以上）。5万人以上は人口で決まる3プラン（ライト／スタンダード／フル・最低¥50,000・3ヶ月以上）。TVerの在庫で使い切れなかった分は、返金・追加請求なしで配信期間を延ばして配信します",
  customPlan: `大規模展開（オーダー）: 月額30万円以上／2エリア以上／週次報告のご希望 のいずれか。15/30/60秒・差し替え可・週1報告。設計・考査費${yen(CUSTOM_DESIGN_FEE)}（初回）＋運用管理費＝媒体費の${CUSTOM_OPS_RATE * 100}%（最低${yen(CUSTOM_OPS_MIN)}／月）。金額はアドアーチが個別にお見積りします`,
  estimate: TVER_ESTIMATE_NOTE,
};

function tverAreaPlanPublic(input: { prefecture: string; city?: string; allCities?: boolean }) {
  const prefs = prefectureOptions();
  if (!prefs.includes(input.prefecture)) return { error: `都道府県名が一致しません。例: ${prefs.slice(0, 5).join("、")} …（「県」「府」まで含めて）` };
  const munis = municipalitiesOf(input.prefecture);

  if (input.allCities) {
    const areas = munis
      .map((m) => {
        const est = estimateArea(input.prefecture, m.code);
        if (!est) return null;
        const rec = est.recommended;
        return {
          city: m.name,
          population: est.plan.population,
          tverViewers: Math.round(est.plan.viewers),
          monthlyFromExclTax: est.minMonthly != null ? yen(est.minMonthly) : null,
          recommended: rec ? { plan: rec.name, monthlyExclTax: yen(rec.monthly), reachPerMonth: Math.round(rec.reach) } : null,
          minMonths: est.minMonths,
          ...(est.minMonthly == null ? { note: "月額30万円以上＝大規模展開（個別にお見積り）" } : {}),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.population - a.population);
    return {
      prefecture: input.prefecture,
      areas,
      rules: TVER_RULES_PUBLIC,
      applyUrl: tverApplyUrl(input.prefecture),
      note: `人口の多い順。${PRICE_NOTE} applyUrl は、相手が申込を希望したときだけ案内する`,
    };
  }

  let code: string | undefined;
  if (input.city) {
    const hit = munis.find((m) => m.name === input.city || m.name.startsWith(input.city!) || m.code === input.city);
    if (!hit) return { error: `市区町村が見つかりません。${input.prefecture}の候補: ${munis.slice(0, 30).map((m) => m.name).join("、")}` };
    code = hit.code;
  }
  const area = resolveArea({ pref: input.prefecture, city: code });
  const est = area.city ? estimateArea(area.pref, area.city) : null;
  if (!est) return { error: "プランを計算できませんでした" };
  return {
    prefecture: est.plan.prefName,
    area: est.plan.areaLabel,
    population: est.plan.population,
    tverViewers: Math.round(est.plan.viewers),
    monthlyGuide: monthlyGuideText(est),
    minMonths: est.minMonths,
    plans: est.tiers.map((t) => ({
      plan: t.name,
      monthlyExclTax: yen(t.monthly),
      impressionsPerMonth: Math.round(t.impressions),
      reachPerMonth: Math.round(t.reach),
      recommended: t.recommended,
      ...(t.custom ? { largeScale: "月額30万円以上＝大規模展開（個別にお見積り）" } : {}),
    })),
    rules: TVER_RULES_PUBLIC,
    applyUrl: tverApplyUrl(est.plan.prefName, area.city ?? undefined),
    note: `${PRICE_NOTE} 再生数・届く人数は目安でお約束するものではありません。applyUrl は、相手が申込を希望したときだけ案内する`,
  };
}

// ---------------- 2. 補助金 ----------------
async function findSubsidies(input: { prefecture?: string; industry?: string; limit?: number }) {
  const pref = normalizePrefecture(input.prefecture);
  const industry = (input.industry ?? "").trim().slice(0, 40);
  const limit = Math.min(20, Math.max(1, input.limit ?? 10));
  const rows = await cached(`studio:subsidy:${pref ?? ""}:${industry}`, 60 * 60 * 1000, () =>
    db.subsidy.findMany({
      where: {
        isActive: true,
        adCostFit: { in: ["CONFIRMED", "LIKELY"] },
        OR: [{ acceptanceEnd: null }, { acceptanceEnd: { gte: new Date() } }],
        ...(pref ? { targetAreas: { hasSome: [pref, "全国"] } } : {}),
        ...(industry ? { industry: { contains: industry } } : {}),
      },
      orderBy: [{ adCostFit: "asc" }, { acceptanceEnd: "asc" }],
      take: 20,
      select: { title: true, institutionName: true, targetAreas: true, subsidyRate: true, maxLimit: true, acceptanceEnd: true, adCostFit: true, fitReason: true, detailUrl: true, guidelineUrl: true },
    }),
  );
  return {
    asOf: new Date().toISOString().slice(0, 10),
    subsidies: rows.slice(0, limit).map((r) => ({
      title: r.title,
      institution: r.institutionName,
      areas: r.targetAreas,
      subsidyRate: r.subsidyRate,
      maxLimitYen: r.maxLimit != null ? Number(r.maxLimit) : null,
      deadline: r.acceptanceEnd ? r.acceptanceEnd.toISOString().slice(0, 10) : null,
      adCost: r.adCostFit === "CONFIRMED" ? "広告費が対象（公募要領で確認済み）" : "広告費が対象になる可能性がある（要確認）",
      reason: r.fitReason,
      url: r.guidelineUrl ?? r.detailUrl,
    })),
    note: "公募の要領（公式）で、対象経費・申請要件・締切を必ずご確認ください。採択は保証されません。",
  };
}

// ---------------- 3. 広告賞 ----------------
function findAdAwards(input: { prefecture?: string; category?: string; includeInternational?: boolean; openOnly?: boolean; limit?: number }) {
  const pref = normalizePrefecture(input.prefecture);
  const limit = Math.min(30, Math.max(1, input.limit ?? 15));
  const now = new Date();
  const rows = AD_AWARDS.filter((a) => {
    if (a.confidence === "LOW") return false;
    if (a.scope === "INTERNATIONAL" && !input.includeInternational) return false;
    if (a.scope === "REGIONAL" && (!pref || !a.prefectures.includes(pref))) return false;
    if (input.category && !a.categories.includes(input.category as (typeof a.categories)[number])) return false;
    return true;
  })
    .map((a) => ({ a, w: entryWindow(a, now) }))
    .filter(({ w }) => !input.openOnly || w.status === "OPEN")
    .sort((x, y) => (x.a.scope === "REGIONAL" ? 0 : 1) - (y.a.scope === "REGIONAL" ? 0 : 1) || x.w.sortKey - y.w.sortKey)
    .slice(0, limit);
  return {
    awards: rows.map(({ a, w }) => ({
      name: a.name,
      organizer: a.organizer,
      scope: SCOPE_META[a.scope].label,
      region: a.region,
      categories: a.categories,
      entryWindow: w.label + (w.isEstimate ? "（前年の日程からの目安）" : ""),
      fee: trim(a.feeRaw, 200),
      eligibility: trim(a.eligibility, 300),
      url: a.url ?? a.sourceUrl,
    })),
    note: "日程・応募条件は主催者の公式ページで必ずご確認ください。",
  };
}

// ---------------- 4. サービス内容と参考価格（本部が公開の印を付けたものだけ） ----------------
async function listServices(input: { category?: string }) {
  const rows = await cached("studio:services", 10 * 60 * 1000, async () => {
    const published = await db.studioPublishedItem.findMany({ where: { type: "PACKAGE" }, orderBy: { sortOrder: "asc" }, select: { refId: true } });
    if (published.length === 0) return [];
    const order = new Map(published.map((p, i) => [p.refId, i]));
    const pkgs = await db.salesPackage.findMany({
      where: { id: { in: published.map((p) => p.refId) }, status: "ACTIVE" },
      // ⚠️ 公開してよい欄だけ（営業文・切り口・社内規定・事例・分担は選ばない）
      select: { id: true, slug: true, name: true, tagline: true, category: true, summary: true, deliverables: true, leadTime: true, priceType: true, initialPrice: true, monthlyPrice: true, priceNote: true, calculator: true },
    });
    return pkgs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  });
  const cat = (input.category ?? "").trim();
  const list = cat ? rows.filter((p) => p.category.includes(cat)) : rows;
  return {
    services: list.map((p) => ({
      id: p.slug,
      name: p.name,
      tagline: p.tagline,
      category: p.category,
      summary: stripSensitiveLines(p.summary) || null,
      deliverables: parseDeliverables(p.deliverables).map((d) => ({ name: stripSensitiveLines(d.name), qty: d.qty, unit: d.unit, spec: stripSensitiveLines(d.spec ?? "") || null })),
      leadTime: p.leadTime,
      priceGuide: `${formatPackagePrice(p)}（目安・税抜）`,
      priceNote: stripSensitiveLines(p.priceNote) || null,
      ...(p.calculator === "tver-area" ? { tip: "エリア別の金額は tver_area_plan で出せます" } : {}),
    })),
    note: PRICE_NOTE,
  };
}

// ---------------- 5. 相談の材料（本部が公開の印を付けた自社の資料・Wiki記事だけ） ----------------
//   ⚠️ 資料ライブラリは origin=OWN（自社）・本部限定でない・取り込み済みのものだけ。他社・媒体社の資料は印があっても出さない
//   ⚠️ Wikiは「本部のみ」「ADMIN向け/専用」のタイトルは印があっても出さない。本文は外に出せない行を落とす
const HQ_TITLE = /ADMIN向け|ADMIN専用|本部のみ/i;
const PUBLIC_BANNED_LINE = [/ロイヤリティ/, /加盟金/, /本部のみ/, /ADMIN/i, /社外秘/, /取り扱い注意/];
function publicText(text: string | null | undefined): string {
  return stripSensitiveLines(text)
    .split(/\r?\n/)
    .filter((line) => !PUBLIC_BANNED_LINE.some((re) => re.test(line)))
    .join("\n")
    .trim();
}

type Guide = { id: string; type: "資料" | "記事"; title: string; summary: string; body: string };

async function publishedGuides(): Promise<Guide[]> {
  return cached("studio:guides", 10 * 60 * 1000, async () => {
    const items = await db.studioPublishedItem.findMany({ where: { type: { in: ["KNOWLEDGE", "WIKI"] } }, orderBy: { sortOrder: "asc" }, select: { type: true, refId: true } });
    const kIds = items.filter((i) => i.type === "KNOWLEDGE").map((i) => i.refId);
    const wIds = items.filter((i) => i.type === "WIKI").map((i) => i.refId);
    const [ks, ws] = await Promise.all([
      kIds.length
        ? db.knowledgeSource.findMany({ where: { id: { in: kIds }, origin: "OWN", hqOnly: false, status: "READY" }, select: { id: true, title: true, summary: true, content: true } })
        : Promise.resolve([]),
      wIds.length ? db.wikiArticle.findMany({ where: { id: { in: wIds } }, select: { id: true, title: true, body: true } }) : Promise.resolve([]),
    ]);
    const guides: Guide[] = [
      ...ks.map((k) => ({ id: `k_${k.id}`, type: "資料" as const, title: k.title, summary: publicText(k.summary).slice(0, 400), body: publicText(k.content) })),
      ...ws.filter((w) => !HQ_TITLE.test(w.title)).map((w) => ({ id: `w_${w.id}`, type: "記事" as const, title: w.title, summary: publicText(w.body).slice(0, 200), body: publicText(w.body) })),
    ];
    const order = new Map(items.map((i, n) => [`${i.type === "KNOWLEDGE" ? "k" : "w"}_${i.refId}`, n]));
    return guides.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  });
}

async function consultGuides(input: { query?: string; limit?: number }) {
  const all = await publishedGuides();
  const limit = Math.min(20, Math.max(1, input.limit ?? 8));
  const words = (input.query ?? "").toLowerCase().split(/[\s、,]+/).filter((w) => w.length > 0).slice(0, 8);
  const scored = all
    .map((g) => {
      const hay = `${g.title}\n${g.body}`.toLowerCase();
      const score = words.length === 0 ? 1 : words.reduce((n, w) => n + (g.title.toLowerCase().includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0);
      return { g, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return {
    guides: scored.map(({ g }) => ({ id: g.id, type: g.type, title: g.title, summary: g.summary })),
    ...(all.length === 0 ? { note: "公開中の相談の材料はまだありません。一般的な知識で相談に答えてかまいませんが、アドアーチの料金・実績・対応範囲については推測で答えないでください。" } : { note: "全文は get_guide(id) で。材料に書いていないアドアーチの料金・実績・対応範囲は、推測で答えないでください。" }),
  };
}

async function getGuide(input: { id: string }) {
  const all = await publishedGuides();
  const g = all.find((x) => x.id === input.id);
  if (!g) return { error: "その材料は公開されていません。consult_guides で id を確認してください。" };
  const max = 20_000;
  return { id: g.id, type: g.type, title: g.title, body: g.body.length > max ? `${g.body.slice(0, max)}\n…（以下省略）` : g.body, note: PRICE_NOTE };
}

// ---------------- 6. 発注・ご依頼（仮押さえ） ----------------
const KIND_VALUES = ["SHOOTING", "VIDEO", "SNS", "MEDIA", "TVER", "OTHER", "CREATOR"] as const;

async function requestOrder(
  input: {
    kind: (typeof KIND_VALUES)[number];
    companyName: string;
    contactName: string;
    email: string;
    phone?: string;
    prefecture?: string;
    location?: string;
    preferredDates?: string;
    budgetRange?: string;
    mediaName?: string;
    detail: string;
  },
  caller: StudioCaller,
) {
  if (input.kind === "CREATOR") {
    return {
      accepted: false,
      message: "クリエイター・制作会社としてのご登録は、こちらのページで受け付けています（ご依頼としては保存していません）。",
      registerUrl: `${publicBaseUrl()}/creators/register`,
    };
  }
  if (input.kind === "SHOOTING" && (!input.location?.trim() || !input.preferredDates?.trim())) {
    return { accepted: false, message: "撮影のご依頼には、撮影の場所（location）と希望の日時（preferredDates）が必要です。ご本人に確認してから送ってください。" };
  }
  if (input.kind === "MEDIA" && !input.mediaName?.trim() && !input.detail.trim()) {
    return { accepted: false, message: "購入したい媒体（mediaName）をご本人に確認してから送ってください。" };
  }
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { accepted: false, message: "メールアドレスの形式をご確認ください。" };

  const limited = await inquiryLimited(caller.ipHash, email);
  if (limited) return { accepted: false, message: limited };

  const detail = input.detail.trim();
  const prefecture = normalizePrefecture(input.prefecture);
  const locationPrefecture = normalizePrefecture(input.location);
  const tverUrl = input.kind === "TVER" ? tverApplyUrl(locationPrefecture ?? prefecture ?? "東京都") : null;

  // 同じ連絡先から同じ本文が24時間以内に来ていたら、新しく作らず同じ受付番号を返す
  const dup = await db.studioInquiry.findFirst({
    where: { email, detail, createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
    select: { number: true, createdAt: true, dueAt: true, assignedBranchId: true },
  });
  if (dup) return acceptedReply({ number: dup.number, createdAt: dup.createdAt, dueAt: dup.dueAt, nearby: !!dup.assignedBranchId, duplicate: true, tverUrl });

  const urlCount = (detail.match(/https?:\/\//g) ?? []).length;
  const suspectedSpam = looksLikeSales(detail) || urlCount >= 3;
  const route = await routeInquiry({ locationPrefecture, prefecture, suspectedSpam });
  const now = new Date();
  const dueAt = addBusinessMinutes(now);

  const row = await db.studioInquiry.create({
    data: {
      kind: input.kind,
      companyName: input.companyName.trim(),
      contactName: input.contactName.trim(),
      email,
      phone: input.phone?.trim() || null,
      prefecture,
      location: input.location?.trim() || null,
      locationPrefecture,
      preferredDates: input.preferredDates?.trim() || null,
      budgetRange: input.budgetRange?.trim() || null,
      mediaName: input.mediaName?.trim() || null,
      detail,
      ipHash: caller.ipHash,
      userAgent: caller.userAgent?.slice(0, 300) ?? null,
      suspectedSpam,
      assignedGroupCompanyId: route.groupCompanyId,
      assignedBranchId: route.branchId,
      routeReason: route.reason,
      dueAt,
      history: [{ at: now.toISOString(), by: "公開MCP", action: "受付", note: route.reason }],
    },
    select: { number: true, createdAt: true, dueAt: true, kind: true },
  });

  const label = inquiryNumberLabel(row.number, row.createdAt);
  await notifyNewInquiry(
    suspectedSpam
      ? { label: `${label}（迷惑の疑い）`, kindLabel: STUDIO_KIND_LABEL[row.kind], pref: null, branchId: null }
      : { label, kindLabel: STUDIO_KIND_LABEL[row.kind], pref: locationPrefecture ?? prefecture, branchId: route.branchId },
  );
  return acceptedReply({ number: row.number, createdAt: row.createdAt, dueAt: row.dueAt, nearby: !!route.branchId, duplicate: false, tverUrl });
}

/**
 * 受付の返答。振り分けの結果で言い方を2通りに分ける（内部の仕組み・社名は見せない）
 *   nearby=true  … 担当表で県の担当が決まった＝「お近くのアドアーチの担当」
 *   nearby=false … 本部の一覧に入った＝「近く」とは書かない（担当がいない県で言い切らない＝優良誤認を避ける）
 */
function acceptedReply(r: { number: number; createdAt: Date; dueAt: Date; nearby: boolean; duplicate: boolean; tverUrl: string | null }) {
  const who = r.nearby ? "お近くのアドアーチの担当" : "アドアーチの担当";
  return {
    accepted: true,
    receiptNumber: inquiryNumberLabel(r.number, r.createdAt),
    message: `アドアーチが承りました。${r.duplicate ? "（同じ内容のご依頼を既に受け付けています）" : ""}営業時間（平日9〜18時）で2時間以内に、${who}からご連絡します（目安: ${formatJst(r.dueAt)}まで）。${r.nearby ? "" : "現地での対応も承ります。"}`,
    notice: "これは仮押さえ（ご依頼の受付）で、契約の成立ではありません。アドアーチの担当から確定のご連絡をした時点で成立します。出張費など現地対応の条件は、確定の前に担当からお伝えします。",
    ...(r.tverUrl ? { tverApplyUrl: r.tverUrl, tverNote: "TVer広告は、こちらの申込ページからエリアとプランを選んでそのままご相談・お申し込みもできます。" } : {}),
    tellTheUser: "受付番号を控えていただくよう、ご本人にお伝えください。",
  };
}

// ---------------- 台帳 ----------------
const s = (max: number) => z.string().trim().min(1).max(max);
const opt = (max: number) => z.string().trim().max(max).optional();
const flag = () => z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());

export const STUDIO_TOOLS: StudioToolDef[] = [
  def({
    name: "consult_guides",
    title: "相談の材料を探す（動画制作・撮影・SNS・広告媒体の使い方）",
    description:
      "アドアーチが公開している相談の材料（自社の資料・記事）を言葉で探す。動画制作の進め方、撮影の準備、SNSの運用、広告媒体の選び方・使い方などの相談に答える前に呼ぶ。query 省略で公開中の一覧。全文は get_guide(id)。アドアーチの料金・実績・対応範囲は、材料に無ければ推測で答えない。",
    input: z.object({ query: z.string().max(100).optional().describe("例: 採用動画 / 撮影の準備 / TVer 使い方"), limit: z.number().int().optional().describe("既定8・最大20") }),
    run: (a) => consultGuides(a),
  }),
  def({
    name: "get_guide",
    title: "相談の材料を全文で読む",
    description: "consult_guides で見つけた材料（id）の全文を返す。価格が書いてあれば目安・税抜として扱う。",
    input: z.object({ id: z.string().max(40) }),
    run: (a) => getGuide(a),
  }),
  def({
    name: "list_services",
    title: "アドアーチのサービス内容と参考価格",
    description: "アドアーチが提供する制作・広告サービス（撮影・動画制作・TVer・SNSなど）の内容・納期・参考価格（目安・税抜）を返す。相手がサービスの内容・料金・見積を知りたいと言ったときに使う（こちらから料金を持ち出さない）。category で絞れる（例: 制作 / TVer / SNS / 採用）。",
    input: z.object({ category: z.string().max(20).optional() }),
    run: (a) => listServices(a),
  }),
  def({
    name: "tver_area_plan",
    title: "TVer広告のエリア別の目安（市区町村ごとの月額・届く人数）",
    description:
      "都道府県＋市区町村を指定すると、アドアーチが扱うTVer広告の市町村プラン（ライト／スタンダード／フル）の月額（税抜）と、月の再生数・届く人数の目安を返す。allCities: true で県内の全市区町村を人口の多い順に返す。金額は目安・税抜。相手が申込を希望したときだけ、返り値の applyUrl（アドアーチのTVer申込ページ）を案内する。",
    input: z.object({
      prefecture: z.string().max(10).describe("例: 香川県（「県」「府」「都」まで）"),
      city: z.string().max(30).optional().describe("例: 高松市（省略で県内の最大の市）"),
      allCities: flag().optional().describe("県内の全市区町村をまとめて"),
    }),
    run: (a) => tverAreaPlanPublic(a),
  }),
  def({
    name: "find_subsidies",
    title: "広告費・動画制作費に使える補助金を探す",
    description:
      "国・自治体の補助金（jGrants）のうち、広告費・動画制作費が対象になる、またはなる可能性がある制度を、締切の近い順に返す。都道府県と業種（例: 製造業、宿泊業、飲食サービス業）で絞れる。採択は保証されない。公式の公募要領で必ず確認するよう添える。",
    input: z.object({
      prefecture: z.string().max(10).optional().describe("例: 香川県（全国の制度は常に含む）"),
      industry: z.string().max(40).optional().describe("業種の言葉（例: 製造業／宿泊業／小売業）"),
      limit: z.number().int().optional().describe("既定10・最大20"),
    }),
    run: (a) => findSubsidies(a),
  }),
  def({
    name: "find_ad_awards",
    title: "出せる広告賞を探す（全国・地方・国際）",
    description: `応募できる広告賞と、次の応募の窓（受付中／次回いつ頃）を返す。都道府県を渡すとその地方の賞を先頭に出す。category は ${AWARD_CATEGORIES.join(" / ")} のどれか。日程は主催者の公式ページで必ず確認するよう添える。`,
    input: z.object({
      prefecture: z.string().max(10).optional(),
      category: z.enum(AWARD_CATEGORIES).optional(),
      includeInternational: flag().optional(),
      openOnly: flag().optional().describe("今受付中のものだけ"),
      limit: z.number().int().optional().describe("既定15・最大30"),
    }),
    run: (a) => findAdAwards(a),
  }),
  def({
    name: "request_order",
    title: "アドアーチに依頼する（相手が依頼を希望したときだけ）",
    description:
      "相手が自分から「頼みたい」「撮影したい」「見積がほしい」「買いたい」と言ったときだけ使う。こちらから依頼を勧めない。撮影・動画制作・SNS・媒体の購入などのご依頼を、アドアーチの窓口で仮押さえとして受け付け、受付番号を返す。営業時間（平日9〜18時）で2時間以内にアドアーチの担当から連絡する。仮押さえは契約の成立ではない（担当からの確定の連絡で成立）。送る前に、会社名・担当者名・メール（任意で電話）・内容を本人に見せて確認し、本人が書いた内容だけを送る。返答の文言（担当が近くかどうか）はそのまま伝える。kind: SHOOTING=撮影（location と preferredDates 必須）/ VIDEO=動画制作 / SNS=SNSの撮影・運用 / MEDIA=媒体の購入（TVer以外。mediaName に媒体名）/ TVER=TVer広告（申込ページのURLも返す）/ OTHER=その他 / CREATOR=クリエイター・制作会社として仕事を受けたい（登録ページを案内し、保存しない）。",
    write: true,
    input: z.object({
      kind: z.enum(KIND_VALUES),
      companyName: s(100).describe("会社名（個人事業の方は屋号）"),
      contactName: s(60).describe("担当者のお名前"),
      email: s(255).describe("連絡先メール"),
      phone: opt(30).describe("電話（任意）"),
      prefecture: opt(10).describe("会社の所在地の都道府県"),
      location: opt(100).describe("撮影地・実施場所（例: 香川県高松市）"),
      preferredDates: opt(200).describe("希望の日時・時期（幅のある書き方でよい）"),
      budgetRange: opt(60).describe("予算の目安（任意）"),
      mediaName: opt(100).describe("媒体の購入のとき、媒体名（例: 地元ラジオ・駅のサイネージ）"),
      detail: z.string().trim().min(5).max(2000).describe("ご依頼の内容（用途・尺・本数・時期など。2000字まで）"),
    }),
    run: (a, caller) => requestOrder(a, caller),
  }),
];

export const STUDIO_INSTRUCTIONS = `${STUDIO_NAME}の相談窓口です。動画制作・撮影・SNS・広告媒体（TVerなど）の使い方について、どなたでも気軽に相談できます。全国のご相談を受け付けており、現地での撮影などは、アドアーチの担当と登録クリエイターが実際に現地で対応します。
【主役は相談に答えること】
- 相談には、consult_guides・get_guide（アドアーチの相談の材料）と一般的な知識で、丁寧に答えてください。TVerのエリアの目安は tver_area_plan、財源は find_subsidies、広告賞は find_ad_awards が使えます。
- こちらから発注・問い合わせ・料金を勧めないでください。「ご依頼はこちら」のような誘導を、返答の末尾に付けないでください。
- 相手が自分から「頼みたい」「撮影したい」「見積がほしい」「買いたい」と言ったときだけ、list_services（サービスと参考価格・目安・税抜）や request_order（依頼の受付）に進んでください。
- request_order は、内容と連絡先を本人に確認してから1回だけ呼び、受付番号と返答の文言をそのまま伝えてください。
【決まり】
- 相手はいつも「アドアーチ」です。担当する会社・個人の名前は、このサーバーは持っていません。
- このサーバーは、アドアーチの顧客・案件・売上の情報を持っていません。アドアーチの料金・実績・対応範囲は、ツールの返り値にないことを推測で答えないでください。
- 価格を伝えるときは必ず「目安・税抜」と添えてください。正式な金額は担当が伺ってからお見積りします。
- 「全国対応」「現地で対応」は伝えてよいが、「全都道府県に拠点がある」「必ず近くの担当が行く」のような数や距離の断言はしないでください。
- 出張費など現地対応の条件は、確定の前に担当が伝えます（金額をこちらで言わない）。
- 仮押さえは契約の成立ではありません。担当からの確定の連絡で成立します。
- クリエイター・制作会社として仕事を受けたい方には、request_order(kind: CREATOR) で登録ページを案内します。`;

/** MCPのプロンプト「consult」（相談の型。依頼へ誘導しない） */
export const STUDIO_CONSULT_PROMPT = (a: { topic?: string }) =>
  `アドアーチ（Ad Arch Studio）の相談窓口を使って、動画制作・撮影・SNS・広告媒体について相談させてください。${a.topic ? `相談したいこと: ${a.topic}\n` : ""}わからないことは短く聞き返してから、consult_guides などの材料をもとに答えてください。私から依頼したいと言うまでは、発注や料金の話は持ち出さないでください。`;
