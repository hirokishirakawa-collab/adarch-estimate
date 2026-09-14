"use server";

// TVer小口申込 — 進捗ページの操作（ログイン不要・token で本人性を担保）

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyCeo } from "@/lib/google-chat";
import { appUrl, ensurePaymentLink } from "@/lib/tver-order/service";
import { orderNumberLabel } from "@/lib/tver-order/plans";

export type MaterialState = { error?: string; success?: boolean } | null;

/** 「お支払いへ進む」（決済リンクが作れていなかった／閉じてしまった時） */
export async function goToPayment(token: string): Promise<{ error?: string }> {
  const o = await db.tverOrder.findUnique({ where: { token }, select: { id: true, status: true } });
  if (!o) return { error: "申込が見つかりません" };
  if (o.status !== "AWAITING_PAYMENT") return { error: "この申込は決済済みです" };
  const r = await ensurePaymentLink(o.id);
  if (!r.url) return { error: r.error ?? "決済ページを用意できませんでした" };
  redirect(r.url);
}

/** 動画のURLを貼る（アップロードは /api/tver-order/[token]/material） */
export async function submitMaterialUrl(_prev: MaterialState, formData: FormData): Promise<MaterialState> {
  const token = String(formData.get("token") ?? "");
  const url = String(formData.get("materialUrl") ?? "").trim().slice(0, 1000);
  const note = String(formData.get("materialNote") ?? "").trim().slice(0, 1000);
  if (!token) return { error: "無効なリンクです" };
  if (!/^https?:\/\//.test(url)) return { error: "動画のURLは http(s):// から入力してください" };
  const o = await db.tverOrder.findUnique({ where: { token }, select: { id: true, status: true, number: true, createdAt: true, advertiserName: true, paidAt: true } });
  if (!o || !o.paidAt) return { error: "決済が完了していません" };
  if (!["PAID", "REVIEWING", "MATERIAL_WAITING", "MATERIAL_RECEIVED"].includes(o.status)) return { error: "この申込は動画を受け付けていません" };
  const next = o.status === "MATERIAL_WAITING" ? "MATERIAL_RECEIVED" : o.status;
  await db.tverOrder.update({ where: { id: o.id }, data: { materialUrl: url, materialNote: note || null, status: next } });
  const no = orderNumberLabel(o.number, o.createdAt);
  logAudit({ action: "tver_order_material_url", email: "form@order", name: o.advertiserName, entity: "tver_order", entityId: o.id, detail: `${no} ${url}` });
  notifyCeo(`🎬 *TVer小口申込 動画URL受領* ${no} ${o.advertiserName}\n${url}${note ? `\n${note}` : ""}\n👉 ${appUrl()}/dashboard/admin/tver-orders/${o.id}`).catch(() => {});
  revalidatePath(`/order/tver/${token}`);
  return { success: true };
}

/** 決済後の詳細記入（法人番号・所在地・代表者ほか） */
export type DetailsState = { error?: string; success?: boolean } | null;

export async function submitOrderDetails(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const token = s("token");
  if (!token) return { error: "無効なリンクです" };
  const { completeTverOrderDetails } = await import("@/lib/tver-order/service");
  const r = await completeTverOrderDetails(token, {
    corporateNumber: s("corporateNumber"),
    postalCode: s("postalCode") || null,
    address: s("address"),
    representativeName: s("representativeName"),
    industry: s("industry") || null,
    landingPageUrl: s("landingPageUrl") || null,
    notes: s("notes") || null,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(`/order/tver/${token}`);
  return { success: true };
}

/** 業態考査の情報（企業ページ・法人番号・商材名・商材サイト）をお客様が記入する（発注書の前） */
export type ReviewInfoState = { error?: string; success?: boolean } | null;

export async function submitReviewInfo(_prev: ReviewInfoState, formData: FormData): Promise<ReviewInfoState> {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const token = s("token");
  if (!token) return { error: "無効なリンクです" };
  const { saveReviewInfo } = await import("@/lib/tver-order/service");
  const r = await saveReviewInfo(
    { token },
    { websiteUrl: s("websiteUrl"), corporateNumber: s("corporateNumber"), hasNoCorporateNumber: formData.get("hasNoCorporateNumber") === "on", productName: s("productName"), productUrl: s("productUrl") },
    { email: "form@order" }
  );
  if (!r.ok) return { error: r.error };
  revalidatePath(`/order/tver/${token}`);
  return { success: true };
}

/** 発注書に署名して、初月のお支払いへ（カード＝Square／振込＝請求書） */
export type SignState = { error?: string } | null;

export async function submitSignature(_prev: SignState, formData: FormData): Promise<SignState> {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const b = (k: string) => formData.get(k) === "on" || formData.get(k) === "1" || formData.get(k) === "true";
  const token = s("token");
  if (!token) return { error: "無効なリンクです" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const { signTverOrder } = await import("@/lib/tver-order/service");
  let r: Awaited<ReturnType<typeof signTverOrder>>;
  try {
    r = await signTverOrder({
      token,
      paymentMethod: s("paymentMethod") === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CARD",
      signerName: s("signerName"),
      agreedTerms: b("agreedTerms"),
      agreedNoGuarantee: b("agreedNoGuarantee"),
      agreedOrder: b("agreedOrder"),
      postalCode: s("postalCode") || null,
      address: s("address"),
      representativeName: s("representativeName"),
      industry: s("industry") || null,
      landingPageUrl: s("landingPageUrl") || null,
      notes: s("notes") || null,
      ip,
      ua: h.get("user-agent"),
    });
  } catch (e) {
    console.error("[order/tver] sign error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
  if (r.error) return { error: r.error };
  revalidatePath(`/order/tver/${token}`);
  if (r.invoiced) redirect(`/order/tver/${token}?invoiced=1`);
  if (r.paymentUrl) redirect(r.paymentUrl);
  return { error: "決済ページに進めませんでした" };
}
