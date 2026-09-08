import { NextResponse } from "next/server";
import { ALL_SCOPES, corsHeaders, issuer } from "@/lib/oauth/server";

// RFC 9728 保護リソースのメタデータ（/api/mcp を守っている認可サーバーはどこか）
export async function GET() {
  const base = await issuer();
  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      scopes_supported: ALL_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "Ad Arch OS",
    },
    { headers: { "Cache-Control": "public, max-age=300", ...corsHeaders() } },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
