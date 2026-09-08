import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { corsHeaders, oauthError, randomToken, sha256 } from "@/lib/oauth/server";

// RFC 7591 動的クライアント登録。Claude / ChatGPT が「コネクタ追加」の裏で自動で叩く。
// 登録は誰でもできるが、トークンはOSにログインして同意した人にしか出ないので害はない。

// IPごと 1時間に30件まで（既存の rate-limit.ts はAI機能の全体上限を共有するので使わない）
const registerHits = new Map<string, { count: number; resetAt: number }>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const e = registerHits.get(ip);
  if (!e || e.resetAt < now) {
    registerHits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  e.count++;
  return e.count > 30;
}

function isAllowedRedirect(u: string): boolean {
  try {
    const url = new URL(u);
    if (url.protocol === "https:") return true;
    // ローカルの開発ツール（MCP Inspector・Claude Code）だけ http を許す
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (tooMany(ip)) return oauthError("too_many_requests", "しばらく待ってからやり直してください", 429);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return oauthError("invalid_client_metadata", "JSON が読めません");
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(isAllowedRedirect)) {
    return oauthError("invalid_redirect_uri", "redirect_uris は https（またはlocalhost）のURLを1〜10件");
  }
  const authMethod = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "client_secret_basic";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(authMethod)) {
    return oauthError("invalid_client_metadata", "token_endpoint_auth_method が未対応です");
  }
  const name = typeof body.client_name === "string" ? body.client_name.trim().slice(0, 80) : null;

  const clientSecret = authMethod === "none" ? null : randomToken(32);
  const client = await db.oAuthClient.create({
    data: { name: name || null, secretHash: clientSecret ? sha256(clientSecret) : null, redirectUris },
  });

  return NextResponse.json(
    {
      client_id: client.id,
      ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.name ?? undefined,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: authMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: { "Cache-Control": "no-store", ...corsHeaders() } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
