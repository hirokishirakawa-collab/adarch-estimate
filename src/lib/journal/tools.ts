import { z } from "zod";
import type { OsToolDef } from "@/lib/mcp/tool-catalog";
import { WriteError } from "@/lib/mcp/os-write-tools";
import { JournalError,saveSchema,writingGuide } from "./model";
import { getEntry,listEntries,saveDraft,submit,uploadPhoto } from "./service";
import { db } from "@/lib/db";
import type { McpViewer } from "@/lib/mcp/os-read-tools";
const def=<A extends z.ZodObject>(v:OsToolDef<A>):OsToolDef=>{
  const run=v.run;
  return {...v,run:async(viewer:McpViewer,args:z.infer<A>)=>{try{return await run(viewer,args);}catch(e){if(e instanceof JournalError || e instanceof z.ZodError)throw new WriteError(e.message);throw e;}}} as unknown as OsToolDef;
};
export const JOURNAL_TOOLS:OsToolDef[]=[
  def({name:"journal_guide",title:"Journalの書き方",kind:"read",description:"身近な読み口のJournal編集方針と投稿形式を取得。記事を書く前に読む。",input:z.object({}),run:()=>({...writingGuide,submissionSchema:z.toJSONSchema(saveSchema)})}),
  def({name:"journal_list",title:"Journalの自分の原稿",kind:"read",description:"本人の投稿一覧。本部だけ全投稿。営業記録や社内報告は取得しない。",input:z.object({}),run:v=>listEntries(v)}),
  def({name:"journal_get",title:"Journal原稿の続き",kind:"read",description:"投稿IDで最新版・revision・確認状況を取得。本人と本部だけ。",input:z.object({id:z.string().uuid()}),run:(v,a)=>getEntry(v,a.id)}),
  def({name:"journal_photos",title:"Journalの写真一覧",kind:"read",description:"本人がJournal用に登録した写真のID。原稿photosのassetIdに使う。",input:z.object({}),run:v=>db.journalAsset.findMany({where:{ownerId:v.id},select:{id:true,createdAt:true},orderBy:{createdAt:"desc"},take:100})}),
  def({name:"journal_save_draft",title:"Journal原稿を保存",kind:"write",description:"本人に見せた原稿をOSへ下書き保存。公開はしない。同じ記事は同じexternalId、更新時はexpectedRevision必須。人物の発言・実績・効果を創作しない。",input:saveSchema,run:(v,a)=>saveDraft(v,a)}),
  def({name:"journal_submit",title:"Journalの確認を依頼",kind:"write",description:"本人の確認済み原稿を本部の確認待ちにする。これだけでは公開されない。",input:z.object({id:z.string().uuid(),revision:z.number().int().positive()}),run:(v,a)=>submit(v,a.id,a.revision)}),
  def({name:"journal_upload_photo",title:"Journalの写真を登録",kind:"write",description:"本人が提供した写真をbase64で登録。8MB以内。JPEGへ変換し位置情報を除去。AIで作った人物写真は使わない。大きい写真はOSのJournal画面から。",input:z.object({base64:z.string().max(12_000_000)}),run:(v,a)=>uploadPhoto(v,a.base64)}),
];
