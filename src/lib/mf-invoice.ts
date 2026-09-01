// ============================================================
// マネーフォワード クラウド請求書 API v3（最小クライアント）
//   認可: https://api.biz.moneyforward.com/authorize  トークン: https://api.biz.moneyforward.com/token
//   API : https://invoice.moneyforward.com/api/v3
//   出典: https://invoice.moneyforward.com/docs/api/v3/index.html（OpenAPI 3.6.0）
//   - アクセストークン1時間／リフレッシュトークン540日・一度使うと無効＝毎回上書き保存
//   - 作成系は1秒3回まで（429）
//   - 請求書作成は POST /invoice_template_billings（department_id が必要）
//   - メール送付APIは無い（pdf_url を取ってOS側で送る／MF画面から送る）
// ============================================================

import { db } from "@/lib/db";

const AUTH_BASE = "https://api.biz.moneyforward.com";
const API_BASE = "https://invoice.moneyforward.com/api/v3";
export const MF_SCOPE = "mfc/invoice/data.write";

export function isMfConfigured(): boolean {
  return !!(process.env.MF_CLIENT_ID && process.env.MF_CLIENT_SECRET);
}
export function mfRedirectUri(): string {
  return process.env.MF_REDIRECT_URI || `${(process.env.AUTH_URL ?? "").replace(/\/$/, "")}/api/mf/callback`;
}
export function mfAuthorizeUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MF_CLIENT_ID ?? "",
    redirect_uri: mfRedirectUri(),
    scope: MF_SCOPE,
    state,
  });
  return `${AUTH_BASE}/authorize?${q.toString()}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; scope?: string; token_type?: string };

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${process.env.MF_CLIENT_ID}:${process.env.MF_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as (TokenResponse & { error?: string; error_description?: string }) | null;
  if (!res.ok || !json?.access_token) throw new Error(`MF token error (HTTP ${res.status}): ${json?.error ?? ""} ${json?.error_description ?? ""}`.trim());
  return json;
}

/// 認可コード → トークン保存（接続）
export async function mfExchangeCode(code: string, connectedById: string): Promise<void> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: mfRedirectUri() });
  await saveTokens(t, connectedById);
}

async function saveTokens(t: TokenResponse, connectedById?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(60, (t.expires_in ?? 3600) - 60) * 1000);
  await db.mfConnection.upsert({
    where: { id: "default" },
    create: { id: "default", accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt, scope: t.scope ?? MF_SCOPE, connectedById: connectedById ?? "system" },
    update: { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt, scope: t.scope ?? MF_SCOPE, ...(connectedById ? { connectedById } : {}) },
  });
}

export async function mfIsConnected(): Promise<boolean> {
  if (!isMfConfigured()) return false;
  const c = await db.mfConnection.findUnique({ where: { id: "default" }, select: { id: true } });
  return !!c;
}

export async function mfDisconnect(): Promise<void> {
  await db.mfConnection.deleteMany({ where: { id: "default" } });
}

/// 有効なアクセストークンを返す（期限切れなら refresh_token で更新し保存）
async function accessToken(): Promise<string> {
  const c = await db.mfConnection.findUnique({ where: { id: "default" } });
  if (!c) throw new Error("MF未接続です（OSの「MFに接続」から承認してください）");
  if (c.expiresAt.getTime() > Date.now()) return c.accessToken;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: c.refreshToken });
  await saveTokens(t);
  return t.access_token;
}

export async function mfFetch<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429 && retry) {
    await new Promise((r) => setTimeout(r, 1200));
    return mfFetch<T>(path, init, false);
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const msg = typeof json === "object" && json && "errors" in json ? JSON.stringify((json as { errors: unknown }).errors) : typeof json === "string" ? json.slice(0, 300) : "";
    throw new Error(`MF API error (HTTP ${res.status}) ${path}: ${msg}`);
  }
  return json as T;
}

// ---------------- 取引先 ----------------
export type MfPartner = { id: string; name: string; code?: string | null; departments?: { id: string; name?: string | null; person_name?: string | null; email?: string | null }[] };

export async function mfSearchPartners(name: string): Promise<MfPartner[]> {
  const q = new URLSearchParams({ name, per_page: "100" });
  const r = await mfFetch<{ data?: MfPartner[]; partners?: MfPartner[] } | MfPartner[]>(`/partners?${q.toString()}`);
  if (Array.isArray(r)) return r;
  return r.data ?? r.partners ?? [];
}

export async function mfGetPartner(id: string): Promise<MfPartner> {
  return mfFetch<MfPartner>(`/partners/${encodeURIComponent(id)}`);
}

export async function mfCreatePartner(input: { name: string; personName?: string | null; email?: string | null }): Promise<MfPartner> {
  const body = {
    name: input.name.slice(0, 100),
    departments: [{ ...(input.personName ? { person_name: input.personName.slice(0, 100) } : {}), ...(input.email ? { email: input.email } : {}) }],
  };
  return mfFetch<MfPartner>("/partners", { method: "POST", body: JSON.stringify(body) });
}

// ---------------- 請求書 ----------------
export type MfBilling = {
  id: string;
  billing_number?: string | null;
  pdf_url?: string | null;
  total_price?: string | number | null;
  payment_status?: string | number | null; // 0未設定/1未入金/2入金済み/3未払い/4振込済み
  partner_id?: string | null;
  department_id?: string | null;
};

export async function mfCreateBilling(input: {
  departmentId: string;
  billingDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  title: string;
  note?: string;
  memo?: string;
  items: { name: string; detail?: string; price: number; quantity: number }[];
}): Promise<MfBilling> {
  const body = {
    department_id: input.departmentId,
    billing_date: input.billingDate,
    due_date: input.dueDate,
    sales_date: input.billingDate,
    title: input.title.slice(0, 200),
    ...(input.note ? { note: input.note.slice(0, 2000) } : {}),
    ...(input.memo ? { memo: input.memo.slice(0, 450) } : {}),
    items: input.items.map((it) => ({
      name: it.name.slice(0, 450),
      ...(it.detail ? { detail: it.detail } : {}),
      price: it.price,
      quantity: it.quantity,
      excise: "ten_percent",
    })),
  };
  return mfFetch<MfBilling>("/invoice_template_billings", { method: "POST", body: JSON.stringify(body) });
}

export async function mfGetBilling(id: string): Promise<MfBilling> {
  return mfFetch<MfBilling>(`/billings/${encodeURIComponent(id)}`);
}

export async function mfSetPaymentStatus(id: string, status: "0" | "1" | "2"): Promise<void> {
  await mfFetch(`/billings/${encodeURIComponent(id)}/payment_status`, { method: "PUT", body: JSON.stringify({ payment_status: status }) });
}

/// PDFをBearer付きで取得（OSから添付送付する用）
export async function mfFetchPdf(pdfUrl: string): Promise<Buffer> {
  const token = await accessToken();
  const res = await fetch(pdfUrl, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`MF PDF error (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
