// ==============================================================
// MCP: TVer 業態考査・配信申請をAIから出す
//   tver_applications     (read)  : 自拠点の業態考査（承認状況）と配信申請（本部の審査状況）
//   preview_tver_campaign (read)  : 配信申請の下見＝エリアを名前からTVer正本のコードに直し、人口と中身を返す（保存しない）
//   submit_advertiser_review (write) : 業態考査を申請（本部が画面で承認する）
//   submit_tver_campaign  (write) : 配信申請（承認済み広告主のみ）
//   決まり: チェック・保存・本部への通知は画面と同じ（lib/tver-campaign/submit）。承認は本部が画面で行う＝AIは申請まで
// ==============================================================

import { db } from "@/lib/db";
import { getBranchFilter } from "@/lib/session";
import { appUrl } from "@/lib/tver-order/service";
import type { Prisma } from "@/generated/prisma/client";
import { getAreaLabel } from "@/lib/constants/tver-campaign";
import {
  areaPopulation,
  createAdvertiserReviewRecord,
  createTverCampaignRecord,
  describeAreas,
  resolveTverAreas,
  validateTverCampaign,
  type AreaQuery,
  type TverActor,
  type TverCampaignInput,
} from "@/lib/tver-campaign/submit";
import type { McpViewer } from "./os-read-tools";
import { WriteError } from "./os-write-tools";

const day = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : null;
const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

function actorOf(v: McpViewer): TverActor {
  const branchId = v.branchId ?? (v.role === "ADMIN" ? "branch_hq" : null);
  if (!branchId) throw new WriteError("拠点が割り当てられていません。本部にお問い合わせください");
  return { userId: v.id, email: v.email, staffName: v.name ?? v.email, branchId };
}

/** "YYYY-MM-DD" → その日の0時(JST)。画面の date 入力と同じ扱い */
function parseDay(s: string | undefined, label: string): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new WriteError(`${label}は YYYY-MM-DD の形にしてください`);
  const d = new Date(`${s}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) throw new WriteError(`${label}が日付として読めません`);
  return d;
}

// ---- 状況 -------------------------------------------------------------------

export async function tverApplications(v: McpViewer, input: { limit?: number }) {
  const take = Math.min(50, Math.max(1, Math.floor(input.limit ?? 20)));
  const where = getBranchFilter(v) as Prisma.AdvertiserReviewWhereInput & Prisma.TverCampaignWhereInput;
  const [reviews, campaigns] = await Promise.all([
    db.advertiserReview.findMany({
      where, orderBy: { createdAt: "desc" }, take,
      select: { id: true, name: true, status: true, reviewNote: true, websiteUrl: true, productUrl: true, createdAt: true, reviewedAt: true },
    }),
    db.tverCampaign.findMany({
      where, orderBy: { createdAt: "desc" }, take,
      select: { id: true, campaignName: true, status: true, reviewNote: true, budget: true, startDate: true, endDate: true, areas: true, createdAt: true, advertiser: { select: { name: true } } },
    }),
  ]);
  return {
    advertisers: reviews.map((r) => ({
      advertiserId: r.id, name: r.name, status: r.status, canApplyCampaign: r.status === "APPROVED",
      reviewNote: r.reviewNote, websiteUrl: r.websiteUrl, productUrl: r.productUrl, appliedAt: day(r.createdAt), reviewedAt: day(r.reviewedAt),
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id, campaignName: c.campaignName, advertiser: c.advertiser?.name ?? null, status: c.status, reviewNote: c.reviewNote,
      budgetExclTax: yen(Number(c.budget)), period: { from: day(c.startDate), to: day(c.endDate) },
      areas: describeAreas(c.areas).map((a) => a.label), url: `${appUrl()}/dashboard/tver-campaign/${c.id}`,
    })),
    rules: "status: 業態考査は PENDING(本部の確認待ち)/APPROVED/REJECTED、配信申請は SUBMITTED/APPROVED/REJECTED/DRAFT。配信申請は APPROVED の広告主だけ出せる。承認は本部が画面で行う",
  };
}

// ---- 業態考査 ---------------------------------------------------------------

export interface SubmitAdvertiserReviewInput {
  name: string;
  websiteUrl: string;
  productUrl: string;
  corporateNumber?: string;
  hasNoCorporateNumber?: boolean;
  desiredStartDate?: string;
  remarks?: string;
}

export async function submitAdvertiserReview(v: McpViewer, input: SubmitAdvertiserReviewInput) {
  const actor = actorOf(v);
  const dup = await db.advertiserReview.findFirst({
    where: { name: input.name?.trim(), status: { in: ["PENDING", "APPROVED"] }, ...(getBranchFilter(v) as Prisma.AdvertiserReviewWhereInput) },
    select: { id: true, status: true },
  });
  if (dup) throw new WriteError(`「${input.name}」は既に業態考査を出しています（${dup.status}・advertiserId: ${dup.id}）。APPROVED なら submit_tver_campaign へ進めます`);

  const r = await createAdvertiserReviewRecord(
    actor,
    {
      name: input.name,
      websiteUrl: input.websiteUrl,
      productUrl: input.productUrl,
      corporateNumber: input.corporateNumber ?? null,
      hasNoCorporateNumber: input.hasNoCorporateNumber ?? false,
      desiredStartDate: input.desiredStartDate ? parseDay(input.desiredStartDate, "desiredStartDate") : null,
      remarks: input.remarks?.trim() || null,
    },
    { via: "AI" }
  );
  if (!r.ok) throw new WriteError(r.error);
  return {
    advertiserId: r.id, status: "PENDING", url: `${appUrl()}/dashboard/tver-review/${r.id}`,
    next: "本部が業態考査を確認します（承認されると申請者にメールが届きます）。承認後に tver_applications で APPROVED を確かめてから submit_tver_campaign を呼ぶ",
  };
}

// ---- 配信申請 ---------------------------------------------------------------

export interface TverCampaignToolInput {
  advertiserId: string;
  campaignName: string;
  budgetJpy: number;
  startDate: string;
  endDate: string;
  budgetType: string;
  areas: AreaQuery[];
  adDurations?: string[];
  devices?: string[];
  genderTarget?: string;
  ageGroups?: string[];
  interests?: string[];
  incomes?: string[];
  tvViewings?: string[];
  demographics?: string[];
  genres?: string[];
  genreExcludes?: string[];
  subGenreExcludes?: string[];
  frequency?: { period?: number; weekly?: number; daily?: number; hourly?: number };
  companionMobile?: string;
  companionPc?: string;
  landingPageUrl?: string;
}

/** AIの入力 → 画面と同じ保存の形（settings のキーは TverCampaignForm と同じ） */
function toCampaignInput(input: TverCampaignToolInput): { data: TverCampaignInput; population: number; areaList: { label: string; population: number }[] } {
  if (!Array.isArray(input.areas) || input.areas.length === 0) throw new WriteError("areas を1つ以上指定してください（例: [{prefecture: '香川県', city: '高松市'}, {prefecture: '香川県', city: '丸亀市'}]）");
  const { codes, errors } = resolveTverAreas(input.areas);
  if (errors.length) throw new WriteError(`エリアを直してください: ${errors.join(" / ")}`);
  const f = input.frequency ?? {};
  for (const [k, n] of Object.entries(f)) {
    if (n != null && (!Number.isInteger(n) || n <= 0)) throw new WriteError(`frequency.${k} は1以上の整数にしてください`);
  }
  const settings = {
    adDurations: input.adDurations?.length ? input.adDurations : ["15"],
    devices: input.devices?.length ? input.devices : ["PC", "SP_IOS", "SP_ANDROID", "CTV"],
    ageGroups: input.ageGroups ?? [],
    interests: input.interests ?? [],
    incomes: input.incomes ?? [],
    tvViewings: input.tvViewings ?? [],
    demographics: input.demographics ?? [],
    genres: input.genres ?? [],
    genreExcludes: input.genreExcludes ?? [],
    subGenreExcludes: input.subGenreExcludes ?? [],
    hourlyRatios: null,
    frequency: { period: f.period ?? null, weekly: f.weekly ?? null, daily: f.daily ?? null, hourly: f.hourly ?? null },
    dailyBudget: false,
    lastDayBudget: false,
    via: "AI",
  };
  return {
    data: {
      advertiserId: input.advertiserId,
      campaignName: input.campaignName ?? "",
      budget: Number(input.budgetJpy),
      startDate: parseDay(input.startDate, "startDate"),
      endDate: parseDay(input.endDate, "endDate"),
      budgetType: (input.budgetType ?? "").toUpperCase(),
      genderTarget: input.genderTarget ?? "ALL",
      companionMobile: input.companionMobile ?? "NONE",
      companionPc: input.companionPc ?? "NONE",
      areas: codes,
      landingPageUrl: input.landingPageUrl?.trim() || null,
      settings,
    },
    population: areaPopulation(codes),
    areaList: describeAreas(codes),
  };
}

function summary(data: TverCampaignInput, areaList: { label: string; population: number }[], population: number, advertiserName: string) {
  const s = data.settings as Record<string, unknown>;
  return {
    advertiser: advertiserName,
    campaignName: data.campaignName,
    budgetExclTax: yen(data.budget),
    budgetType: data.budgetType,
    period: { from: day(data.startDate), to: day(data.endDate) },
    areas: areaList,
    areaCount: areaList.length,
    totalPopulation: population,
    areaCodes: data.areas.map((c) => ({ code: c, label: getAreaLabel(c) })),
    targeting: {
      gender: data.genderTarget, adDurations: s.adDurations, devices: s.devices, ageGroups: s.ageGroups, interests: s.interests,
      incomes: s.incomes, tvViewings: s.tvViewings, demographics: s.demographics, genres: s.genres, genreExcludes: s.genreExcludes,
      subGenreExcludes: s.subGenreExcludes, frequency: s.frequency,
    },
    landingPageUrl: data.landingPageUrl,
  };
}

export async function previewTverCampaign(v: McpViewer, input: TverCampaignToolInput) {
  const { data, population, areaList } = toCampaignInput(input);
  const checked = await validateTverCampaign(data, getBranchFilter(v) as Prisma.AdvertiserReviewWhereInput);
  if (!checked.ok) return { ok: false, error: checked.error, next: "直してから preview_tver_campaign を呼び直す" };
  return {
    ok: true,
    ...summary(data, areaList, population, checked.advertiserName),
    note: "人口は住民基本台帳（2025年1月1日）。届く人数・再生数の目安は tver_benchmarks / tver_area_plan で",
    next: "この内容（エリアの一覧・人口・期間・予算・ターゲティング）を本人に見せ、OKをもらってから submit_tver_campaign を同じ入力で呼ぶ",
  };
}

export async function submitTverCampaign(v: McpViewer, input: TverCampaignToolInput) {
  const actor = actorOf(v);
  const { data, population, areaList } = toCampaignInput(input);
  const r = await createTverCampaignRecord(actor, data, { advertiserWhere: getBranchFilter(v) as Prisma.AdvertiserReviewWhereInput, via: "AI" });
  if (!r.ok) throw new WriteError(r.error);
  return {
    id: r.id,
    status: "SUBMITTED",
    url: `${appUrl()}/dashboard/tver-campaign/${r.id}`,
    ...summary(data, areaList, population, r.advertiserName),
    next: "本部に通知しました。審査の結果は tver_applications で確かめられます",
  };
}
