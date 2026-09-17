// ==============================================================
// TVer 業態考査・配信申請 — 画面（server action）と AI連携（MCP・アーチくん）の共通の中身
//   チェック・保存・操作ログ・本部への通知を1か所にして、どちらから出しても同じ申請になるようにする。
//   エリアは「都道府県コード（hokkaido 等）」か「TVer正本の市区町村コード（5桁）」の配列で保存する。
//   AIは名前（香川県＋高松市）で渡すので resolveTverAreas でコードに直す。
// ==============================================================

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { sendTverCampaignCreatedEmail } from "@/lib/resend";
import { sendAdvertiserReviewCreatedNotification } from "@/lib/notifications";
import { validateCorporateNumber } from "@/lib/constants/advertiser-review";
import { logAudit } from "@/lib/audit";
import { MUNICIPALITIES } from "@/data/tver-municipalities";
import { areaPopulation, areaUnits, checkAreaBudgets, type AreaBudget } from "@/lib/tver-campaign/area-budgets";
import {
  BUDGET_TYPE_OPTIONS,
  COMPANION_MOBILE_OPTIONS,
  COMPANION_PC_OPTIONS,
  GENDER_TARGET_OPTIONS,
  FREQ_CAP_UNIT_OPTIONS,
  TVER_PREFECTURES,
  isMunicipalityCode,
  municipalityOf,
  prefLabelOf,
} from "@/lib/constants/tver-campaign";

export { areaPopulation };

export interface TverActor {
  userId: string;
  email: string;
  staffName: string;
  branchId: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

// ---- エリア -----------------------------------------------------------------

const LIVE_MUNIS = MUNICIPALITIES.filter((m) => m.population > 0);

/** 県・市区町村コードの配列を、重複と不正を除いて整える（県全体を選んだ県の市区町村は外す） */
export function normalizeAreaCodes(raw: string[]): string[] {
  const codes = [...new Set(raw.map((c) => c.trim()).filter((c) => c && (prefLabelOf(c) !== undefined || isMunicipalityCode(c))))];
  const wholePrefs = new Set(codes.map((c) => prefLabelOf(c)).filter(Boolean));
  return codes.filter((c) => !isMunicipalityCode(c) || !wholePrefs.has(municipalityOf(c)!.prefName));
}

function findPref(s: string) {
  const t = s.trim();
  return TVER_PREFECTURES.find((p) => p.label === t || p.code === t || p.label.replace(/[都府県]$/, "") === t);
}

export interface AreaQuery {
  prefecture: string;
  /** 省略で県全体。「札幌市」「札幌市（全区）」は全区、「札幌市北区」はその区だけ。5桁コードも可 */
  city?: string;
}

/** 名前で渡されたエリアをコードに直す。見つからない・曖昧なものは errors に候補つきで返す */
export function resolveTverAreas(items: AreaQuery[]): { codes: string[]; errors: string[] } {
  const codes: string[] = [];
  const errors: string[] = [];
  for (const it of items) {
    const pref = findPref(it.prefecture ?? "");
    if (!pref) {
      errors.push(`都道府県「${it.prefecture}」が見つかりません`);
      continue;
    }
    const city = (it.city ?? "").trim().replace(/[（(]全区[）)]$/, "");
    if (!city) {
      codes.push(pref.code);
      continue;
    }
    const rows = LIVE_MUNIS.filter((m) => m.prefName === pref.label);
    const byCode = rows.find((m) => m.code === city);
    if (byCode) { codes.push(byCode.code); continue; }
    const exact = rows.find((m) => m.name === city);
    if (exact) { codes.push(exact.code); continue; }
    const wards = rows.filter((m) => m.name.startsWith(city) && /区$/.test(m.name) && /市$/.test(city));
    if (wards.length > 0) { codes.push(...wards.map((m) => m.code)); continue; }
    const partial = rows.filter((m) => m.name.includes(city));
    if (partial.length === 1) { codes.push(partial[0].code); continue; }
    errors.push(
      partial.length > 1
        ? `${pref.label}「${city}」が複数あります: ${partial.slice(0, 10).map((m) => m.name).join("、")}`
        : `${pref.label}に「${city}」がありません（TVer配信エリアの市区町村名で指定してください）`
    );
  }
  return { codes: normalizeAreaCodes(codes), errors };
}

/** 表示用: 県はそのまま、政令市の区がそろっていれば「○○市（全区）」にまとめる */
export function describeAreas(codes: string[]): { label: string; population: number }[] {
  return areaUnits(codes).map(({ label, population }) => ({ label, population }));
}

// ---- 配信申請 ---------------------------------------------------------------

export interface TverCampaignInput {
  advertiserId: string;
  campaignName: string;
  budget: number;
  startDate: Date;
  endDate: Date;
  budgetType: string;
  freqCapUnit?: string | null;
  freqCapCount?: number | null;
  companionMobile?: string;
  companionPc?: string;
  genderTarget?: string;
  areas: string[];
  landingPageUrl?: string | null;
  settings?: Prisma.InputJsonValue | null;
}

const has = (opts: readonly { value: string }[], v: string) => opts.some((o) => o.value === v);

/** 配信申請のチェック（保存はしない）。AIの下見と保存の両方で使う */
export async function validateTverCampaign(
  input: TverCampaignInput,
  advertiserWhere: Prisma.AdvertiserReviewWhereInput = {}
): Promise<Result<{ advertiserName: string; areas: string[]; areaBudgets: (AreaBudget & { label: string })[] | null }>> {
  if (!input.advertiserId) return fail("広告主を選択してください");
  if (!input.campaignName?.trim()) return fail("キャンペーン名を入力してください");
  if (input.campaignName.trim().length > 200) return fail("キャンペーン名は200文字以内にしてください");
  if (!Number.isFinite(input.budget) || input.budget <= 0) return fail("広告予算を正しく入力してください");
  if (Number.isNaN(input.startDate.getTime())) return fail("配信開始日の形式が正しくありません");
  if (Number.isNaN(input.endDate.getTime())) return fail("配信終了日の形式が正しくありません");
  if (input.endDate <= input.startDate) return fail("配信終了日は開始日より後に設定してください");
  if (!has(BUDGET_TYPE_OPTIONS, input.budgetType)) return fail("予算タイプを選択してください");
  if (input.genderTarget && !has(GENDER_TARGET_OPTIONS, input.genderTarget)) return fail("性別ターゲティングの値が正しくありません");
  if (input.companionMobile && !has(COMPANION_MOBILE_OPTIONS, input.companionMobile)) return fail("コンパニオンAD（モバイル）の値が正しくありません");
  if (input.companionPc && !has(COMPANION_PC_OPTIONS, input.companionPc)) return fail("コンパニオンAD（PC）の値が正しくありません");
  if (input.freqCapUnit && !has(FREQ_CAP_UNIT_OPTIONS, input.freqCapUnit)) return fail("フリークエンシーキャップの単位が正しくありません");
  if (input.freqCapCount != null && (!Number.isInteger(input.freqCapCount) || input.freqCapCount <= 0))
    return fail("フリークエンシーキャップの回数を正しく入力してください");

  const areas = normalizeAreaCodes(input.areas);
  if (areas.length === 0) return fail("配信エリアを1つ以上選択してください");

  // エリアが2つ以上なら、エリアごとの媒体費（settings.areaBudgets）の合計＝広告予算
  const rawSettings = input.settings && typeof input.settings === "object" && !Array.isArray(input.settings)
    ? (input.settings as Record<string, unknown>)
    : {};
  const budgets = checkAreaBudgets(areas, input.budget, rawSettings.areaBudgets);
  if (!budgets.ok) return fail(budgets.error);

  if (input.landingPageUrl) {
    try { new URL(input.landingPageUrl); }
    catch { return fail("リンク先LP URLの形式が正しくありません"); }
  }

  // APPROVED 広告主かどうかを DB で再確認（二重ガード）
  const advertiser = await db.advertiserReview.findFirst({
    where: { id: input.advertiserId, status: "APPROVED", ...advertiserWhere },
    select: { name: true },
  });
  if (!advertiser) return fail("選択された広告主は承認済みではありません");

  return { ok: true, advertiserName: advertiser.name, areas, areaBudgets: budgets.areaBudgets };
}

/** 保存する settings の areaBudgets を、確かめた形（ラベルつき・エリア順）に置き換える */
function settingsWithAreaBudgets(
  settings: Prisma.InputJsonValue | null | undefined,
  areaBudgets: (AreaBudget & { label: string })[] | null
): Prisma.InputJsonValue | undefined {
  const base = settings && typeof settings === "object" && !Array.isArray(settings)
    ? { ...(settings as Record<string, Prisma.InputJsonValue>) }
    : null;
  const saved = areaBudgets as unknown as Prisma.InputJsonValue;
  if (!base) return areaBudgets ? { areaBudgets: saved } : (settings ?? undefined);
  delete base.areaBudgets;
  return areaBudgets ? { ...base, areaBudgets: saved } : base;
}

/** 配信申請を保存し、本部へメールで知らせる */
export async function createTverCampaignRecord(
  actor: TverActor,
  input: TverCampaignInput,
  opts: { advertiserWhere?: Prisma.AdvertiserReviewWhereInput; via?: "AI" } = {}
): Promise<Result<{ id: string; advertiserName: string; areas: string[]; areaBudgets: (AreaBudget & { label: string })[] | null }>> {
  const checked = await validateTverCampaign(input, opts.advertiserWhere);
  if (!checked.ok) return checked;

  let id: string;
  try {
    const created = await db.tverCampaign.create({
      data: {
        advertiserId:    input.advertiserId,
        campaignName:    input.campaignName.trim(),
        budget:          String(Math.round(input.budget)),
        startDate:       input.startDate,
        endDate:         input.endDate,
        budgetType:      input.budgetType as Prisma.TverCampaignCreateInput["budgetType"],
        freqCapUnit:     (input.freqCapUnit ?? null) as Prisma.TverCampaignCreateInput["freqCapUnit"],
        freqCapCount:    input.freqCapCount ?? null,
        companionMobile: (input.companionMobile ?? "NONE") as Prisma.TverCampaignCreateInput["companionMobile"],
        companionPc:     (input.companionPc ?? "NONE") as Prisma.TverCampaignCreateInput["companionPc"],
        genderTarget:    (input.genderTarget ?? "ALL") as Prisma.TverCampaignCreateInput["genderTarget"],
        areas:           checked.areas,
        landingPageUrl:  input.landingPageUrl ?? null,
        settings:        settingsWithAreaBudgets(input.settings, checked.areaBudgets),
        status:          "SUBMITTED",
        createdById:     actor.userId,
        creatorEmail:    actor.email,
        branchId:        actor.branchId,
      },
    });
    id = created.id;
    logAudit({
      action: "tver_campaign_created", email: actor.email, name: actor.staffName, entity: "tver_campaign", entityId: id,
      detail: opts.via === "AI" ? `[AI連携] ${input.campaignName}` : input.campaignName,
    });
  } catch (e) {
    console.error("[createTverCampaignRecord] DB error:", e instanceof Error ? e.message : e);
    return fail("保存に失敗しました");
  }

  const fmtDate = (d: Date) => new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(d);
  sendTverCampaignCreatedEmail({
    campaignId:     id,
    campaignName:   input.campaignName.trim(),
    advertiserName: checked.advertiserName,
    budget:         `¥${Math.round(input.budget).toLocaleString("ja-JP")}`,
    startDate:      fmtDate(input.startDate),
    endDate:        fmtDate(input.endDate),
    staffName:      opts.via === "AI" ? `${actor.staffName}（AI連携）` : actor.staffName,
  }).catch((e) => console.error("[createTverCampaignRecord] email error:", e));

  return { ok: true, id, advertiserName: checked.advertiserName, areas: checked.areas, areaBudgets: checked.areaBudgets };
}

// ---- 業態考査 ---------------------------------------------------------------

export interface AdvertiserReviewInput {
  name: string;
  websiteUrl: string;
  productUrl: string;
  corporateNumber?: string | null;
  hasNoCorporateNumber: boolean;
  desiredStartDate?: Date | null;
  remarks?: string | null;
}

/** 業態考査の申請を保存し、本部へ知らせる */
export async function createAdvertiserReviewRecord(
  actor: TverActor,
  input: AdvertiserReviewInput,
  opts: { via?: "AI" } = {}
): Promise<Result<{ id: string }>> {
  const name = input.name?.trim();
  const websiteUrl = input.websiteUrl?.trim();
  const productUrl = input.productUrl?.trim();
  if (!name)       return fail("広告主様名を入力してください");
  if (!websiteUrl) return fail("企業ページURLを入力してください");
  if (!productUrl) return fail("商材サイトURLを入力してください");

  const corpValidation = validateCorporateNumber(input.corporateNumber ?? undefined, input.hasNoCorporateNumber);
  if (corpValidation !== true) return fail(corpValidation);

  if (input.desiredStartDate && Number.isNaN(input.desiredStartDate.getTime()))
    return fail("広告展開希望日の形式が正しくありません");

  let id: string;
  try {
    const created = await db.advertiserReview.create({
      data: {
        name,
        websiteUrl,
        corporateNumber:      input.hasNoCorporateNumber ? null : (input.corporateNumber?.trim() ?? null),
        hasNoCorporateNumber: input.hasNoCorporateNumber,
        productUrl,
        desiredStartDate:     input.desiredStartDate ?? null,
        remarks:              input.remarks ?? null,
        createdById:          actor.userId,
        creatorEmail:         actor.email,
        branchId:             actor.branchId,
      },
    });
    id = created.id;
    logAudit({
      action: "advertiser_review_created", email: actor.email, name: actor.staffName, entity: "advertiser_review", entityId: id,
      detail: opts.via === "AI" ? `[AI連携] ${name}` : name,
    });
  } catch (e) {
    console.error("[createAdvertiserReviewRecord] DB error:", e instanceof Error ? e.message : e);
    return fail("保存に失敗しました");
  }

  sendAdvertiserReviewCreatedNotification({
    reviewId:       id,
    advertiserName: name,
    staffName:      opts.via === "AI" ? `${actor.staffName}（AI連携）` : actor.staffName,
    productUrl,
  }).catch((e) => console.error("[createAdvertiserReviewRecord] notification error:", e));

  return { ok: true, id };
}
