"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { AUTH_CODE_TTL_SEC, type Scope, parseScopes, randomToken } from "@/lib/oauth/server";

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
}

export interface ValidatedRequest {
  ok: true;
  client: { id: string; name: string | null };
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: Scope[];
}
export type AuthorizeValidation = ValidatedRequest | { ok: false; reason: string };

/** 認可リクエストの検証。redirect_uri が登録と一致しない限り、相手先へは絶対に飛ばさない */
export async function validateAuthorizeRequest(sp: Record<string, string | undefined>): Promise<AuthorizeValidation> {
  if (sp.response_type !== "code") return { ok: false, reason: "response_type は code のみ対応しています" };
  if (!sp.client_id) return { ok: false, reason: "client_id がありません" };
  const client = await db.oAuthClient.findUnique({ where: { id: sp.client_id }, select: { id: true, name: true, redirectUris: true } });
  if (!client) return { ok: false, reason: "登録されていないクライアントです。AI側でコネクタを登録し直してください" };
  const redirectUri = sp.redirect_uri ?? "";
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) return { ok: false, reason: "redirect_uri が登録と一致しません" };
  if ((sp.code_challenge_method ?? "S256") !== "S256" || !sp.code_challenge) return { ok: false, reason: "PKCE（S256）が必要です" };
  const scopes = parseScopes(sp.scope);
  if (scopes.length === 0) return { ok: false, reason: "対応していない権限が要求されました" };
  return { ok: true, client: { id: client.id, name: client.name }, redirectUri, state: sp.state ?? "", codeChallenge: sp.code_challenge, scopes };
}

/** 相手先（Claude / ChatGPT）へ戻す。CSP の form-action 'self' があるため、同一オリジンの中継ページ(/oauth/authorize/done)経由で飛ばす */
function backTo(clientId: string, redirectUri: string, params: Record<string, string>): never {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri });
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  redirect(`/oauth/authorize/done?${q.toString()}`);
}

/** 同意画面のボタン（許可／拒否） */
export async function decideAuthorize(formData: FormData): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const decision = String(formData.get("decision") ?? "");
  const sp = {
    response_type: "code",
    client_id: String(formData.get("client_id") ?? ""),
    redirect_uri: String(formData.get("redirect_uri") ?? ""),
    state: String(formData.get("state") ?? ""),
    code_challenge: String(formData.get("code_challenge") ?? ""),
    code_challenge_method: "S256",
    scope: String(formData.get("scope") ?? ""),
  };
  const v = await validateAuthorizeRequest(sp);
  if (!v.ok) redirect(`/oauth/authorize?error=${encodeURIComponent(v.reason)}`);

  if (decision !== "approve") {
    backTo(v.client.id, v.redirectUri, { error: "access_denied", state: v.state });
  }

  const code = randomToken(32);
  await db.oAuthAuthCode.create({
    data: {
      code,
      clientId: v.client.id,
      userEmail: email,
      redirectUri: v.redirectUri,
      codeChallenge: v.codeChallenge,
      scope: v.scopes.join(" "),
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SEC * 1000),
    },
  });
  await logAudit({
    action: "mcp_connected",
    email,
    name: session?.user?.name ?? null,
    entity: "oauth_client",
    entityId: v.client.id,
    detail: `${v.client.name ?? "AIクライアント"} に許可: ${v.scopes.join(", ")}`,
  });
  backTo(v.client.id, v.redirectUri, { code, state: v.state });
}
