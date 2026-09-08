import { NextResponse } from "next/server";
import { ALL_SCOPES, corsHeaders, issuer } from "@/lib/oauth/server";

// RFC 8414 認可サーバーのメタデータ。AIクライアントはまずここを読んで各エンドポイントを知る
export async function GET() {
  const base = await issuer();
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      scopes_supported: ALL_SCOPES,
      service_documentation: `${base}/dashboard/brand-kit`,
    },
    { headers: { "Cache-Control": "public, max-age=300", ...corsHeaders() } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
