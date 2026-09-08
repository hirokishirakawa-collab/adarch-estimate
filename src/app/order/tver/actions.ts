"use server";

// TVer小口申込 — 申込フォームの送信（ログイン不要）
//   検証・保存・Square決済リンク作成は lib/tver-order/service.ts。ここは FormData の受け取りと IP/UA の取得だけ。

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTverOrder } from "@/lib/tver-order/service";

export type OrderFormState = { error?: string; token?: string } | null;

// 同一IPからの連打を抑える（メモリ・プロセス単位）
const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const arr = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  arr.push(now);
  recent.set(ip, arr);
  return arr.length > 6;
}

export async function submitTverOrder(_prev: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent");
  if (ip && tooMany(ip)) return { error: "短時間に送信が続いています。しばらくしてからお試しください。" };

  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const b = (k: string) => formData.get(k) === "on" || formData.get(k) === "1" || formData.get(k) === "true";

  let result: Awaited<ReturnType<typeof createTverOrder>>;
  try {
    result = await createTverOrder({
      from: s("from") || null,
      prefName: s("prefName"),
      municipalityCode: s("municipalityCode"),
      planKey: s("planKey"),
      months: [3, 6, 12].includes(Number(s("months"))) ? Number(s("months")) : 3,
      hasVideo: s("hasVideo") !== "no",
      paymentMethod: s("paymentMethod") === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CARD",
      advertiserName: s("advertiserName"),
      contactName: s("contactName"),
      email: s("email"),
      phone: s("phone"),
      signerName: s("signerName"),
      agreedTerms: b("agreedTerms"),
      agreedNoGuarantee: b("agreedNoGuarantee"),
      agreedRefund: b("agreedRefund"),
      ip,
      ua,
    });
  } catch (e) {
    console.error("[order/tver] submit error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
  if (result.error) return { error: result.error, token: result.token };
  if (result.invoiced && result.token) redirect(`/order/tver/${result.token}?invoiced=1`);
  if (result.paymentUrl) redirect(result.paymentUrl);
  return { error: "決済ページに進めませんでした" };
}
