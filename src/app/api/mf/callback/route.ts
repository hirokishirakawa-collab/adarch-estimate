import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionInfo } from "@/lib/session";
import { mfExchangeCode } from "@/lib/mf-invoice";
import { logAudit } from "@/lib/audit";

// MF 認可コールバック（ADMINのみ）。code をトークンに交換してDBへ保存し、ロイヤリティ状況へ戻る。
export async function GET(req: NextRequest) {
  const info = await getSessionInfo();
  if (!info) return new NextResponse("Unauthorized", { status: 401 });
  if (info.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const jar = await cookies();
  const expected = jar.get("mf_oauth_state")?.value;
  jar.delete("mf_oauth_state");

  const back = new URL("/dashboard/admin/royalty", url.origin);
  if (err) { back.searchParams.set("mf", `error:${err}`); return NextResponse.redirect(back); }
  if (!code || !state || !expected || state !== expected) { back.searchParams.set("mf", "error:state"); return NextResponse.redirect(back); }

  try {
    await mfExchangeCode(code, info.userId);
    logAudit({ action: "mf_connected", email: info.email, name: info.staffName, entity: "mf_connection", entityId: "default", detail: "MFクラウド請求書に接続" });
    back.searchParams.set("mf", "connected");
  } catch (e) {
    console.error("[mf/callback]", e instanceof Error ? e.message : e);
    back.searchParams.set("mf", "error:token");
  }
  return NextResponse.redirect(back);
}
