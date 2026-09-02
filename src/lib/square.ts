// ============================================================
// Square Payment Links API（最小クライアント）
//   POST   /v2/online-checkout/payment-links      → 決済リンク作成
//   DELETE /v2/online-checkout/payment-links/{id} → 削除
// 参考: https://developer.squareup.com/reference/square/checkout-api/create-payment-link
// 環境変数: SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID / SQUARE_ENV(production|sandbox)
// ============================================================

import { randomUUID } from "crypto";

const SQUARE_VERSION = "2025-01-23";

export function isSquareConfigured(): boolean {
  return !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

function baseUrl(): string {
  return (process.env.SQUARE_ENV ?? "production").toLowerCase() === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

async function squareFetch(path: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  let json: unknown = null;
  try { json = await res.json(); } catch { /* 204 等 */ }
  return { ok: res.ok, status: res.status, json };
}

function errorMessage(json: unknown, status: number): string {
  const errs = (json as { errors?: { code?: string; detail?: string; category?: string }[] } | null)?.errors;
  if (errs?.length) return errs.map((e) => `${e.code ?? e.category ?? "ERROR"}: ${e.detail ?? ""}`).join(" / ");
  return `Square API error (HTTP ${status})`;
}

export type SquarePaymentLink = { id: string; url: string; longUrl: string | null; orderId: string | null };

/// 決済リンクを作る。JPYは最小単位が円なので amount はそのまま円。
export async function createSquarePaymentLink(input: {
  name: string; // 品名（Square上・領収メールに出る）
  amountJpy: number; // 税込
  paymentNote?: string; // 支払いに付くメモ（入金特定用）
  description?: string; // チェックアウト画面の説明
}): Promise<{ link?: SquarePaymentLink; error?: string }> {
  if (!isSquareConfigured()) return { error: "Squareが未設定です（SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID）" };
  const amount = Math.max(0, Math.round(input.amountJpy));
  if (amount <= 0) return { error: "金額が0です" };

  const body = {
    idempotency_key: randomUUID(),
    quick_pay: {
      name: input.name.slice(0, 255),
      price_money: { amount, currency: "JPY" },
      location_id: process.env.SQUARE_LOCATION_ID,
    },
    ...(input.paymentNote ? { payment_note: input.paymentNote.slice(0, 500) } : {}),
    ...(input.description ? { description: input.description.slice(0, 4096) } : {}),
    checkout_options: {
      ask_for_shipping_address: false,
      allow_tipping: false,
    },
  };
  try {
    const r = await squareFetch("/v2/online-checkout/payment-links", { method: "POST", body: JSON.stringify(body) });
    if (!r.ok) return { error: errorMessage(r.json, r.status) };
    const pl = (r.json as { payment_link?: { id: string; url: string; long_url?: string; order_id?: string } }).payment_link;
    if (!pl?.id || !pl.url) return { error: "Squareの応答にリンクが含まれていません" };
    return { link: { id: pl.id, url: pl.url, longUrl: pl.long_url ?? null, orderId: pl.order_id ?? null } };
  } catch (e) {
    return { error: `Square接続エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export type SquarePaymentRecord = {
  id: string;
  status?: string;
  order_id?: string | null;
  created_at?: string;
  note?: string | null;
  amount_money?: { amount?: number; currency?: string };
  card_details?: { card?: { last_4?: string; card_brand?: string } };
};

/// 決済一覧（新しい順）。見張り役（ウェブフック取りこぼしの照合）用。
export async function listSquarePayments(opts: { beginTime: string; maxPages?: number }): Promise<{ payments?: SquarePaymentRecord[]; error?: string }> {
  if (!isSquareConfigured()) return { error: "Squareが未設定です" };
  const out: SquarePaymentRecord[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < (opts.maxPages ?? 3); page++) {
      const q = new URLSearchParams({ begin_time: opts.beginTime, sort_order: "DESC", limit: "100" });
      if (cursor) q.set("cursor", cursor);
      const r = await squareFetch(`/v2/payments?${q.toString()}`, { method: "GET" });
      if (!r.ok) return { error: errorMessage(r.json, r.status) };
      const j = r.json as { payments?: SquarePaymentRecord[]; cursor?: string };
      out.push(...(j.payments ?? []));
      cursor = j.cursor;
      if (!cursor) break;
    }
    return { payments: out };
  } catch (e) {
    return { error: `Square接続エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/// 決済リンクを削除（作り直し時）。既に無い場合も成功扱い。
export async function deleteSquarePaymentLink(id: string): Promise<{ error?: string }> {
  if (!isSquareConfigured()) return { error: "Squareが未設定です" };
  try {
    const r = await squareFetch(`/v2/online-checkout/payment-links/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok && r.status !== 404) return { error: errorMessage(r.json, r.status) };
    return {};
  } catch (e) {
    return { error: `Square接続エラー: ${e instanceof Error ? e.message : String(e)}` };
  }
}
