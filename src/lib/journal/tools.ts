import { z } from "zod";
import type { OsToolDef } from "@/lib/mcp/tool-catalog";
import { WriteError } from "@/lib/mcp/os-write-tools";
import { JournalError,saveSchema,reviewSchema,writingGuide } from "./model";
import { getEntry,hqEdit,listEntries,publishChecks,review,saveDraft,submit,uploadPhoto } from "./service";
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
  def({name:"journal_submit",title:"Journalに公開",kind:"write",description:"本人が最終確認した原稿をadarch.co.jp/journal/へ公開する（数分で載る。本部が後から表現を整えることがある）。押す前に本文・写真・タイトルを本人に見せ、事実・担当範囲（factsChecked）、写真・社名の掲載範囲（rightsChecked）、人物ページは本人確認（personChecked）を本人が確かめたと明言した場合だけtrueにする。",input:z.object({id:z.string().uuid(),revision:z.number().int().positive()}).extend(publishChecks.shape),run:(v,a)=>submit(v,a.id,a.revision,a)}),
  def({name:"journal_review",title:"Journalの公開を承認（本部）",kind:"write",description:"本部（ADMIN）だけ。確認待ちの原稿を承認するとadarch.co.jp/journal/へ数分で公開される。approveの前にjournal_getの本文・写真・URL名（slug）を本部に見せ、事実・担当範囲（factsChecked）、写真・社名の掲載範囲（rightsChecked）、人物ページは本人確認（personChecked）を本部が確かめたと明言した場合だけtrueにする。slugを渡すとURL名を直して承認（初回公開前のみ）。return=修正依頼、withdraw=掲載取り下げ。各社の記事は本人の公開で載るため、通常は journal_hq_edit で後から直す。",input:reviewSchema,run:(v,a)=>review(v,a)}),
  def({name:"journal_hq_edit",title:"Journalの記事を直す（本部）",kind:"write",description:"本部（ADMIN）だけ。各社の記事の本文・タイトル・写真を直す。公開中の記事は保存と同時に数分で差し替わる。journal_getのcontentを元に直した全体をcontentに、revisionをexpectedRevisionに渡す。直す前に変更箇所を本部に見せる。投稿者・URLは変わらない。",input:z.object({id:z.string().uuid(),expectedRevision:z.number().int().positive(),content:saveSchema.shape.content}),run:(v,a)=>hqEdit(v,a)}),
  def({name:"journal_upload_photo",title:"Journalの写真を登録",kind:"write",description:"本人が提供した写真をbase64で登録。8MB以内。JPEGへ変換し位置情報を除去。AIで作った人物写真は使わない。大きい写真はOSのJournal画面から。",input:z.object({base64:z.string().max(12_000_000)}),run:(v,a)=>uploadPhoto(v,a.base64)}),
];
