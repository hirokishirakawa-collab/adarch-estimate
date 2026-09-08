// ==============================================================
// OAuth 2.1 認可サーバー（OS内蔵・MCP連携用）— 共通ロジック
//   Claude / ChatGPT 等のAIクライアントが「カスタムコネクタ」で接続するときの
//   動的登録・認可コード＋PKCE・トークン発行・検証をここに集約する。
//   アクセストークン＝jose署名JWT（1時間・DBに持たない）
//   リフレッシュトークン＝OAuthGrant 1行（=「接続」。画面で解除できる）
// ==============================================================

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1時間
export const REFRESH_TOKEN_TTL_DAYS = 30; // 最終利用から30日
export const AUTH_CODE_TTL_SEC = 10 * 60; // 10分

/** 権限（同意画面に出す単位）。順番＝同意画面の表示順 */
export const SCOPES = {
  brand_kit: { label: "ブランドキット", desc: "AI用材料（決まり・会社紹介・メニュー別/媒体別の数字・切り口・Wiki材料）を読む" },
  "os:read": { label: "OSの読み取り", desc: "貴社の顧客・商談・見積（品目）・パッケージ台帳・TVerプラン・Wiki・拠点一覧を読む。売上や金額の数字は本部のみ。書き込みはしない" },
} as const;
export type Scope = keyof typeof SCOPES;
export const ALL_SCOPES = Object.keys(SCOPES) as Scope[];

const JWT_ISSUER_CLAIM = "adarch-os-mcp";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET が未設定です");
  return new TextEncoder().encode(`mcp:${s}`);
}

/** 公開URL（issuer）。プロキシ越しでも正しいホストを返す */
export async function issuer(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** PKCE S256: base64url(sha256(verifier)) === challenge */
export function verifyPkce(verifier: string, challenge: string): boolean {
  const digest = createHash("sha256").update(verifier).digest("base64url");
  return safeEqual(digest, challenge);
}

export function parseScopes(raw: string | null | undefined): Scope[] {
  const asked = (raw ?? "").split(/[\s,]+/).filter(Boolean);
  if (asked.length === 0) return ALL_SCOPES; // 指定なし＝全部（同意画面で全部見せる）
  return ALL_SCOPES.filter((s) => asked.includes(s));
}

// ---- アクセストークン ---------------------------------------------------

export interface AccessTokenClaims {
  email: string;
  clientId: string;
  grantId: string;
  scopes: Scope[];
  exp: number;
}

export async function signAccessToken(input: { email: string; clientId: string; grantId: string; scopes: Scope[]; audience: string }): Promise<string> {
  return new SignJWT({ cid: input.clientId, gid: input.grantId, scope: input.scopes.join(" ") })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setIssuer(JWT_ISSUER_CLAIM)
    .setAudience(input.audience)
    .setSubject(input.email)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SEC}s`)
    .sign(secret());
}

/** 署名・期限・aud を検証し、接続(OAuthGrant)が生きていて利用者が有効なら中身を返す */
export async function verifyAccessToken(token: string, audience: string): Promise<(AccessTokenClaims & { name: string | null; clientName: string | null }) | null> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, secret(), { issuer: JWT_ISSUER_CLAIM, audience }));
  } catch {
    return null;
  }
  const email = typeof payload.sub === "string" ? payload.sub : "";
  const clientId = typeof payload.cid === "string" ? payload.cid : "";
  const grantId = typeof payload.gid === "string" ? payload.gid : "";
  if (!email || !clientId || !grantId) return null;

  const [grant, user] = await Promise.all([
    db.oAuthGrant.findUnique({ where: { id: grantId }, select: { revokedAt: true, clientName: true, userEmail: true } }),
    db.user.findUnique({ where: { email }, select: { isActive: true, name: true } }),
  ]);
  if (!grant || grant.revokedAt || grant.userEmail !== email) return null;
  if (!user || !user.isActive) return null;

  // 最終利用時刻（失敗しても本体は止めない）
  void db.oAuthGrant.update({ where: { id: grantId }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return {
    email,
    clientId,
    grantId,
    scopes: parseScopes(typeof payload.scope === "string" ? payload.scope : ""),
    exp: typeof payload.exp === "number" ? payload.exp : 0,
    name: user.name,
    clientName: grant.clientName,
  };
}

// ---- クライアント認証 ---------------------------------------------------

/** client_secret を持つクライアントは照合。持たない（public）クライアントは client_id の存在だけ */
export async function authenticateClient(req: Request, form: URLSearchParams) {
  let clientId = form.get("client_id") ?? "";
  let clientSecret = form.get("client_secret") ?? "";
  const basic = req.headers.get("authorization");
  if (basic?.toLowerCase().startsWith("basic ")) {
    const [id, sec] = Buffer.from(basic.slice(6), "base64").toString().split(":");
    clientId = decodeURIComponent(id ?? "");
    clientSecret = decodeURIComponent(sec ?? "");
  }
  if (!clientId) return null;
  const client = await db.oAuthClient.findUnique({ where: { id: clientId } });
  if (!client) return null;
  if (client.secretHash) {
    if (!clientSecret || !safeEqual(sha256(clientSecret), client.secretHash)) return null;
  }
  return client;
}

// ---- 掃除 -----------------------------------------------------------------

/** 期限切れの認可コードを消す（トークン発行のついでに） */
export async function sweepExpiredCodes(): Promise<void> {
  try {
    await db.oAuthAuthCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    /* noop */
  }
}

/** JSONレスポンス（OAuthエラー形式） */
export function oauthError(error: string, description: string, status = 400): Response {
  return Response.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store", ...corsHeaders() } });
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
  };
}
