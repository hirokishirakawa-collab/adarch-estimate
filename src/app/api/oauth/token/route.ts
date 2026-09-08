import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_DAYS,
  authenticateClient,
  corsHeaders,
  issuer,
  oauthError,
  parseScopes,
  randomToken,
  sha256,
  signAccessToken,
  sweepExpiredCodes,
  verifyPkce,
} from "@/lib/oauth/server";

// トークンエンドポイント（RFC 6749 §4.1.3 / §6 ＋ PKCE）
//   authorization_code: 同意画面で出したコードを、アクセストークン＋リフレッシュトークンに替える
//   refresh_token     : 1時間で切れるアクセストークンを取り直す（リフレッシュトークンは毎回ローテーション）

async function readForm(req: Request): Promise<URLSearchParams> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = (await req.json()) as Record<string, unknown>;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(j)) if (typeof v === "string") p.set(k, v);
    return p;
  }
  return new URLSearchParams(await req.text());
}

function tokenResponse(input: { accessToken: string; refreshToken: string; scope: string }) {
  return NextResponse.json(
    {
      access_token: input.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SEC,
      refresh_token: input.refreshToken,
      scope: input.scope,
    },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache", ...corsHeaders() } },
  );
}

const refreshExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

export async function POST(req: Request) {
  const form = await readForm(req);
  const grantType = form.get("grant_type");
  const client = await authenticateClient(req, form);
  if (!client) return oauthError("invalid_client", "クライアント認証に失敗しました", 401);
  const audience = `${await issuer()}/api/mcp`;

  if (grantType === "authorization_code") {
    const code = form.get("code") ?? "";
    const verifier = form.get("code_verifier") ?? "";
    const redirectUri = form.get("redirect_uri") ?? "";
    if (!code || !verifier) return oauthError("invalid_request", "code と code_verifier が必要です");

    await sweepExpiredCodes();
    const row = await db.oAuthAuthCode.findUnique({ where: { code } });
    // 1回使い切り。見つかったら成否に関わらず消す
    if (row) await db.oAuthAuthCode.delete({ where: { code } }).catch(() => {});
    if (!row || row.expiresAt < new Date()) return oauthError("invalid_grant", "認可コードが無効か期限切れです");
    if (row.clientId !== client.id) return oauthError("invalid_grant", "認可コードのクライアントが一致しません");
    if (redirectUri && row.redirectUri !== redirectUri) return oauthError("invalid_grant", "redirect_uri が一致しません");
    if (!verifyPkce(verifier, row.codeChallenge)) return oauthError("invalid_grant", "PKCE の検証に失敗しました");

    const user = await db.user.findUnique({ where: { email: row.userEmail }, select: { isActive: true } });
    if (!user?.isActive) return oauthError("invalid_grant", "このアカウントは利用できません");

    const refreshToken = randomToken(32);
    const grant = await db.oAuthGrant.create({
      data: {
        tokenHash: sha256(refreshToken),
        clientId: client.id,
        clientName: client.name,
        userEmail: row.userEmail,
        scope: row.scope,
        expiresAt: refreshExpiry(),
      },
    });
    const accessToken = await signAccessToken({ email: row.userEmail, clientId: client.id, grantId: grant.id, scopes: parseScopes(row.scope), audience });
    return tokenResponse({ accessToken, refreshToken, scope: row.scope });
  }

  if (grantType === "refresh_token") {
    const presented = form.get("refresh_token") ?? "";
    if (!presented) return oauthError("invalid_request", "refresh_token が必要です");
    const grant = await db.oAuthGrant.findUnique({ where: { tokenHash: sha256(presented) } });
    if (!grant || grant.revokedAt || grant.clientId !== client.id) return oauthError("invalid_grant", "リフレッシュトークンが無効です");
    if (grant.expiresAt < new Date()) return oauthError("invalid_grant", "接続の期限が切れました。もう一度コネクタを接続してください");

    const user = await db.user.findUnique({ where: { email: grant.userEmail }, select: { isActive: true } });
    if (!user?.isActive) return oauthError("invalid_grant", "このアカウントは利用できません");

    // ローテーション: 新しいリフレッシュトークンに差し替え、期限も延ばす
    const refreshToken = randomToken(32);
    await db.oAuthGrant.update({ where: { id: grant.id }, data: { tokenHash: sha256(refreshToken), expiresAt: refreshExpiry(), lastUsedAt: new Date() } });
    const accessToken = await signAccessToken({ email: grant.userEmail, clientId: client.id, grantId: grant.id, scopes: parseScopes(grant.scope), audience });
    return tokenResponse({ accessToken, refreshToken, scope: grant.scope });
  }

  return oauthError("unsupported_grant_type", "grant_type は authorization_code か refresh_token");
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
