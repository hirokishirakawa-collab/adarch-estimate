"use server";

// TVer小口申込 — 相談フォームの送信（ログイン不要）
//   2026-09-14〜 申込ページは「相談の受付」。お金は発生しない＝面談・電話 → 業態考査 → 発注書に署名 → 支払い
//   検証・保存・通知は lib/tver-order/service.ts。ここは FormData の受け取りと IP/UA の取得だけ。

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTverConsult } from "@/lib/tver-order/service";

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

export async function submitTverConsult(_prev: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const ua = h.get("user-agent");
  if (ip && tooMany(ip)) return { error: "短時間に送信が続いています。しばらくしてからお試しください。" };

  const s = (k: string) => String(formData.get(k) ?? "").trim();

  let result: Awaited<ReturnType<typeof createTverConsult>>;
  try {
    result = await createTverConsult({
      from: s("from") || null,
      prefName: s("prefName"),
      municipalityCode: s("municipalityCode"),
      planKey: s("planKey"),
      months: Number(s("months")) || 0, // 期間の検証（選択肢・人口5万人未満は6ヶ月以上）は service 側
      hasVideo: s("hasVideo") !== "no",
      advertiserName: s("advertiserName"),
      contactName: s("contactName"),
      email: s("email"),
      phone: s("phone"),
      websiteUrl: s("websiteUrl"),
      consultMethod: s("consultMethod"),
      consultPreferredTime: s("consultPreferredTime") || null,
      consultMessage: s("consultMessage") || null,
      ip,
      ua,
    });
  } catch (e) {
    console.error("[order/tver] consult submit error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
  if (result.error || !result.token) return { error: result.error ?? "送信に失敗しました" };
  redirect(`/order/tver/${result.token}?consulted=1`);
}
