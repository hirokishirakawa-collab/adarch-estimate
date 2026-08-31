"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo, getBranchFilter } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notifyAdmins, createInAppNotification } from "@/lib/notifications";
import { planForCodes, fmtMan, fmtYen, type AdSeconds } from "@/lib/tver/plan";
import { generateHeroImage, normalizeHeroImage, HERO_MAX_UPLOAD_BYTES } from "@/lib/tver/hero-image";
import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/types/roles";

const BASE = "/dashboard/tver-flyer";

function toSeconds(raw: string | null): AdSeconds {
  const n = Number(raw);
  return n === 30 || n === 60 ? n : 15;
}

// ---------------------------------------------------------------
// 依頼を作成する（MANAGER 以上）
// ---------------------------------------------------------------
export async function createTverFlyerRequest(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role === "USER") return { error: "権限がありません" };

  const codes = formData.getAll("codes").map((c) => String(c).trim()).filter(Boolean);
  const clientName = (formData.get("clientName") as string)?.trim() || null;
  const industry = (formData.get("industry") as string)?.trim() || null;
  const adSeconds = toSeconds(formData.get("adSeconds") as string);
  const budgetManRaw = (formData.get("budgetMan") as string)?.trim();
  const note = (formData.get("note") as string)?.trim() || null;

  if (codes.length === 0) return { error: "商圏（市区町村）を1つ以上選択してください" };
  if (codes.length > 30) return { error: "市区町村は30件以内で選択してください" };

  let budget: number | null = null;
  if (budgetManRaw) {
    const n = Number(budgetManRaw.replace(/[,，]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return { error: "予算は万円単位の数字で入力してください" };
    budget = Math.round(n * 10_000);
  }

  const plan = planForCodes(codes, adSeconds);
  if (!plan) return { error: "選択した市区町村が見つかりません" };
  const prefs = new Set(plan.municipalities.map((m) => m.prefName));
  if (prefs.size > 1) return { error: "商圏は同じ都道府県内で選択してください（複数県は別依頼に分けてください）" };

  // 発行者の初期値: グループ企業名 → 拠点名 の順
  let issuerName: string | null = null;
  try {
    const u = await db.user.findUnique({
      where: { id: info.userId },
      select: { groupCompany: { select: { name: true } }, branch: { select: { name: true } } },
    });
    issuerName = u?.groupCompany?.name ?? u?.branch?.name ?? null;
  } catch { /* 初期値なしで続行 */ }

  let createdId: string;
  try {
    const created = await db.tverFlyerRequest.create({
      data: {
        municipalityCodes: codes,
        prefName: plan.prefName,
        areaLabel: plan.areaLabel,
        clientName,
        industry,
        adSeconds,
        budget,
        note,
        issuerName,
        issuerContact: info.staffName,
        branchId: info.branchId || null,
        createdById: info.userId,
      },
    });
    createdId = created.id;
    logAudit({ action: "tver_flyer_created", email: info.email, name: info.staffName, entity: "tver_flyer_request", entityId: created.id, detail: plan.areaLabel });
  } catch (e) {
    console.error("[createTverFlyerRequest] DB error:", e instanceof Error ? e.message : e);
    return { error: "保存に失敗しました" };
  }

  notifyAdmins({
    type: "SYSTEM",
    title: `📄 チラシ制作依頼: ${plan.areaLabel}（${plan.prefName}）`,
    message: [
      clientName ? `クライアント: ${clientName}` : null,
      industry ? `業種: ${industry}` : null,
      `依頼者: ${info.staffName}`,
      `計算値: 視聴者${fmtMan(plan.viewers)} ／ 月額${fmtYen(plan.monthly)} ／ 3ヶ月${fmtYen(plan.total)}`,
    ].filter(Boolean).join("\n"),
    linkUrl: `${BASE}/${createdId}`,
  }).catch((e) => console.error("[createTverFlyerRequest] notify error:", e));

  revalidatePath(BASE);
  redirect(`${BASE}/${createdId}`);
}

// ---------------------------------------------------------------
// 本部が仕上げて納品する（ADMIN のみ）
// ---------------------------------------------------------------
export async function updateTverFlyerRequest(
  requestId: string,
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "本部のみ操作できます" };

  const status = (formData.get("status") as string)?.trim();
  if (!["PENDING", "REVIEWING", "DELIVERED", "CANCELLED"].includes(status)) return { error: "ステータスが不正です" };

  const numOrNull = (key: string): number | null | "bad" => {
    const raw = (formData.get(key) as string)?.trim();
    if (!raw) return null;
    const n = Number(raw.replace(/[,，¥]/g, ""));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : "bad";
  };
  const monthlyOverride = numOrNull("monthlyOverride");
  const totalOverride = numOrNull("totalOverride");
  if (monthlyOverride === "bad" || totalOverride === "bad") return { error: "金額は数字で入力してください" };

  const catchCopy = (formData.get("catchCopy") as string)?.trim() || null;
  const issuerName = (formData.get("issuerName") as string)?.trim() || null;
  const issuerContact = (formData.get("issuerContact") as string)?.trim() || null;
  const replyNote = (formData.get("replyNote") as string)?.trim() || null;

  const existing = await db.tverFlyerRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, areaLabel: true, createdById: true, deliveredAt: true },
  });
  if (!existing) return { error: "対象の依頼が見つかりません" };

  const becomesDelivered = status === "DELIVERED" && existing.status !== "DELIVERED";

  try {
    await db.tverFlyerRequest.update({
      where: { id: requestId },
      data: {
        status: status as Prisma.TverFlyerRequestUpdateInput["status"],
        monthlyOverride,
        totalOverride,
        catchCopy,
        issuerName,
        issuerContact,
        replyNote,
        deliveredAt: status === "DELIVERED" ? (existing.deliveredAt ?? new Date()) : null,
      },
    });
    logAudit({ action: "tver_flyer_updated", email: info.email, name: info.staffName, entity: "tver_flyer_request", entityId: requestId, detail: status });
  } catch (e) {
    console.error("[updateTverFlyerRequest] DB error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }

  if (becomesDelivered && existing.createdById) {
    createInAppNotification({
      userId: existing.createdById,
      type: "SYSTEM",
      title: `📄 チラシが納品されました: ${existing.areaLabel}`,
      message: replyNote ? `本部より: ${replyNote}` : "OSからPDFをダウンロードできます。",
      linkUrl: `${BASE}/${requestId}`,
      forceEmail: true,
    }).catch((e) => console.error("[updateTverFlyerRequest] notify error:", e));
  }

  revalidatePath(`${BASE}/${requestId}`);
  revalidatePath(BASE);
  return { ok: true };
}

// ---------------------------------------------------------------
// 依頼者が取り下げる（受付中のみ）
// ---------------------------------------------------------------
export async function cancelTverFlyerRequest(requestId: string): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role === "USER") return { error: "権限がありません" };

  const existing = await db.tverFlyerRequest.findFirst({
    where: { id: requestId, ...getBranchFilter(info) },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "対象の依頼が見つかりません" };
  if (existing.status !== "PENDING") return { error: "本部が作成に入った依頼は取り下げできません（本部へご連絡ください）" };

  await db.tverFlyerRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  logAudit({ action: "tver_flyer_cancelled", email: info.email, name: info.staffName, entity: "tver_flyer_request", entityId: requestId });
  revalidatePath(`${BASE}/${requestId}`);
  revalidatePath(BASE);
  return {};
}

// ---------------------------------------------------------------
// 業種別の一言をAIで下書きする（ADMIN のみ・DBには保存しない）
// ---------------------------------------------------------------
export async function generateFlyerCatchCopy(requestId: string): Promise<{ text?: string; error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  if (info.role !== "ADMIN") return { error: "本部のみ操作できます" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY が設定されていません" };

  const r = await db.tverFlyerRequest.findUnique({
    where: { id: requestId },
    select: { municipalityCodes: true, adSeconds: true, industry: true, clientName: true, note: true },
  });
  if (!r) return { error: "対象の依頼が見つかりません" };
  const plan = planForCodes(r.municipalityCodes, toSeconds(String(r.adSeconds)));
  if (!plan) return { error: "商圏の計算に失敗しました" };

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const prompt = [
    `あなたは地方の中小企業向けにTVer広告を提案する広告会社のコピーライターです。`,
    `A4チラシに載せる「業種別の一言」を日本語で書いてください。`,
    ``,
    `【条件】`,
    `- 商圏: ${plan.prefName}${plan.areaLabel}（人口 ${plan.population.toLocaleString()}人・TVer視聴者 推計${fmtMan(plan.viewers)}）`,
    `- 業種: ${r.industry ?? "未指定（一般的な地元企業）"}`,
    r.clientName ? `- クライアント: ${r.clientName}` : null,
    r.note ? `- 依頼メモ: ${r.note}` : null,
    `- 商品: 商圏のTVer視聴者の3人に1人へ月平均約5回、標準3ヶ月で商圏の認知を取り切るプラン`,
    ``,
    `【書き方】`,
    `- 2〜3文・全体で90文字以内・1文は30文字以内。丁寧語。文ごとに改行する（1文=1行）。`,
    `- その業種の客がテレビ番組を見ている場面から入り、「地元で選ばれる理由づくり」に着地させる。`,
    `- 再生数・安さ・「業界最安」・保証・効果の断定は書かない。数字は書かない。`,
    `- 見出しや記号、絵文字は使わない。本文のみを出力する。`,
  ].filter(Boolean).join("\n");

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      thinking: { type: "disabled" }, // 既定の思考モードで max_tokens を使い切ると本文が空になる
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!text) return { error: "生成結果が空でした" };
    return { text };
  } catch (e) {
    console.error("[generateFlyerCatchCopy] error:", e instanceof Error ? e.message : e);
    return { error: "AI生成に失敗しました" };
  }
}

// ---------------------------------------------------------------
// 上部のビジュアル（ヒーロー画像）— ADMIN のみ。生成／アップロード／外す
//   画像はOS（DB）に保存し、PDFには data URL で埋め込む。無ければ従来のSVGイラストで出る
// ---------------------------------------------------------------
const HERO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function requireAdminAndRequest(requestId: string) {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" as const };
  if (info.role !== "ADMIN") return { error: "本部のみ操作できます" as const };
  const r = await db.tverFlyerRequest.findUnique({ where: { id: requestId }, select: { id: true, areaLabel: true } });
  if (!r) return { error: "対象の依頼が見つかりません" as const };
  return { info, r };
}

export async function generateFlyerHeroImage(requestId: string, prompt: string): Promise<{ ok?: true; error?: string }> {
  const ctx = await requireAdminAndRequest(requestId);
  if ("error" in ctx) return { error: ctx.error };
  const p = (prompt ?? "").trim();
  if (p.length < 10) return { error: "プロンプトが短すぎます（何を描くかを書いてください）" };
  if (p.length > 2000) return { error: "プロンプトは2000文字以内にしてください" };

  try {
    const img = await generateHeroImage(p);
    await db.tverFlyerRequest.update({
      where: { id: requestId },
      data: { heroImage: img.data, heroImageType: img.type, heroPrompt: p },
    });
    logAudit({ action: "tver_flyer_hero_generated", email: ctx.info.email, name: ctx.info.staffName, entity: "tver_flyer_request", entityId: requestId, detail: ctx.r.areaLabel });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generateFlyerHeroImage] error:", msg);
    return { error: `画像の生成に失敗しました: ${msg}` };
  }
  revalidatePath(`${BASE}/${requestId}`);
  return { ok: true };
}

export async function uploadFlyerHeroImage(
  requestId: string,
  _prev: { ok?: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await requireAdminAndRequest(requestId);
  if ("error" in ctx) return { error: ctx.error };

  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file) || (file as File).size === 0) return { error: "画像ファイルを選択してください" };
  const f = file as File;
  if (!HERO_TYPES.has(f.type)) return { error: "JPEG / PNG / WebP の画像を選択してください" };
  if (f.size > HERO_MAX_UPLOAD_BYTES) return { error: "画像は12MB以内にしてください" };

  try {
    const img = await normalizeHeroImage(new Uint8Array(await f.arrayBuffer()));
    await db.tverFlyerRequest.update({
      where: { id: requestId },
      data: { heroImage: img.data, heroImageType: img.type },
    });
    logAudit({ action: "tver_flyer_hero_uploaded", email: ctx.info.email, name: ctx.info.staffName, entity: "tver_flyer_request", entityId: requestId, detail: f.name });
  } catch (e) {
    console.error("[uploadFlyerHeroImage] error:", e instanceof Error ? e.message : e);
    return { error: "画像の保存に失敗しました（ファイルが壊れていないか確認してください）" };
  }
  revalidatePath(`${BASE}/${requestId}`);
  return { ok: true };
}

export async function deleteFlyerHeroImage(requestId: string): Promise<{ ok?: true; error?: string }> {
  const ctx = await requireAdminAndRequest(requestId);
  if ("error" in ctx) return { error: ctx.error };
  try {
    await db.tverFlyerRequest.update({ where: { id: requestId }, data: { heroImage: null, heroImageType: null } });
    logAudit({ action: "tver_flyer_hero_removed", email: ctx.info.email, name: ctx.info.staffName, entity: "tver_flyer_request", entityId: requestId });
  } catch (e) {
    console.error("[deleteFlyerHeroImage] error:", e instanceof Error ? e.message : e);
    return { error: "更新に失敗しました" };
  }
  revalidatePath(`${BASE}/${requestId}`);
  return { ok: true };
}

// ---------------------------------------------------------------
// 一覧・単件取得
// ---------------------------------------------------------------
async function fetchList(where: Prisma.TverFlyerRequestWhereInput) {
  return db.tverFlyerRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    omit: { heroImage: true }, // 一覧に画像バイナリは載せない
    include: {
      createdBy: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
}

export async function getTverFlyerList() {
  const empty = { requests: [] as Awaited<ReturnType<typeof fetchList>>, role: "USER" as UserRole };
  try {
    const info = await getSessionInfo();
    if (!info || info.role === "USER") return empty;
    const requests = await fetchList(getBranchFilter(info));
    return { requests, role: info.role };
  } catch (e) {
    console.error("[getTverFlyerList] error:", e instanceof Error ? e.message : e);
    return empty;
  }
}

export async function getTverFlyerById(requestId: string) {
  try {
    const info = await getSessionInfo();
    if (!info || info.role === "USER") notFound();

    const request = await db.tverFlyerRequest.findFirst({
      where: { id: requestId, ...getBranchFilter(info) },
      include: {
        createdBy: { select: { name: true, email: true } },
        branch: { select: { name: true } },
      },
    });
    if (!request) notFound();
    return { request, role: info.role };
  } catch (e) {
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    console.error("[getTverFlyerById] error:", e instanceof Error ? e.message : e);
    notFound();
  }
}
