import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { JournalError } from "./model";

export async function viewer() {
  const session=await auth();
  const v=session?.user?.email ? await loadViewer(session.user.email) : null;
  if(!v) throw new JournalError("ログインしてください",401);
  return v;
}
export function sameOrigin(req:Request) {
  // セッションCookieで行う変更だけに使用。MCPは既存Bearer認証。
  const origin=req.headers.get("origin");
  const expected=process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  if(!origin || origin!==new URL(expected).origin) throw new JournalError("ページを開き直してください",403);
}
export function publisher(req:Request) {
  const token=process.env.JOURNAL_PUBLISH_TOKEN;
  if(!token || token.length<32) throw new JournalError("公開連携はまだ有効になっていません",503);
  const actual=Buffer.from(req.headers.get("authorization")??""); const expected=Buffer.from(`Bearer ${token}`);
  if(actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw new JournalError("認証が必要です",401);
}
export async function bytes(req:Request,limit=1_000_000) {
  if(Number(req.headers.get("content-length")??0)>limit) throw new JournalError("ファイルが大きすぎます",413);
  const reader=req.body?.getReader(); if(!reader) throw new JournalError("内容がありません");
  const chunks:Uint8Array[]=[]; let size=0;
  for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new JournalError("ファイルが大きすぎます",413);}chunks.push(value);}
  return Buffer.concat(chunks);
}
export async function body(req:Request) {
  const data=await bytes(req);
  try{return JSON.parse(data.toString("utf8"));}catch{throw new JournalError("原稿の形式を確認してください");}
}
export async function respond(fn:()=>Promise<unknown>) {
  try {return NextResponse.json(await fn(),{headers:{"Cache-Control":"no-store"}});}
  catch(e) {
    const status=e instanceof JournalError?e.status:e instanceof ZodError?400:500;
    const message=e instanceof JournalError?e.message:e instanceof ZodError?e.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("\n"):"処理を完了できませんでした。内容を保存して再度お試しください";
    if(status===500) console.error("[journal] operation failed", e instanceof Error?e.name:"error");
    return NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
  }
}
