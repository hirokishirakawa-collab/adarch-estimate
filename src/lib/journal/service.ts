import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { McpViewer } from "@/lib/mcp/os-read-tools";
import { contentSchema, saveSchema, reviewSchema, publicContent, publicPath, JournalError, isPlaceholderSlug, type JournalContent } from "./model";
import { suggestSlug, uniqueSlug } from "./slug";
import { notifyAdmins } from "@/lib/notifications";

const stable = (v:unknown):string => JSON.stringify(v,(_k,value)=>value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))) : value);
const json = (v:unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const scope = (v:McpViewer) => v.role === "ADMIN" ? {} : {ownerId:v.id};
function writer(v:McpViewer) {if(v.role !== "ADMIN" && !v.branchId) throw new JournalError("拠点の登録が必要です",403);}
export async function getEntry(v:McpViewer,id:string) {
  const row=await db.journalEntry.findFirst({where:{id,...scope(v)}});
  if(!row) throw new JournalError("記事が見つかりません",404);
  return row;
}
export async function listEntries(v:McpViewer) {
  return db.journalEntry.findMany({where:scope(v), orderBy:{createdAt:"desc"}, take:1000,
    select:{id:true,externalId:true,title:true,kind:true,slug:true,ownerName:true,status:true,revision:true,approvedRevision:true,deliveredRevision:true,firstPublishedAt:true,createdAt:true,updatedAt:true,reviewNote:true}});
}
export async function saveDraft(v:McpViewer, raw:unknown) {
  writer(v); const input=saveSchema.parse(raw), draft=input.content;
  const ids=[...new Set(draft.photos.map(p=>p.assetId))];
  if(ids.length !== await db.journalAsset.count({where:{id:{in:ids},...scope(v)}}))
    throw new JournalError("利用できない写真が含まれています",403);
  // URL名：公開後は固定。未公開なら省略時は前回のまま、新規で省略ならAIが地域名と中身から付ける（AI呼び出しはトランザクションの外）。
  const existing=await db.journalEntry.findUnique({where:{ownerId_externalId:{ownerId:v.id, externalId:input.externalId}}});
  const requested=isPlaceholderSlug(draft.slug)?undefined:draft.slug;
  if(existing?.firstPublishedAt && requested && requested!==existing.slug) throw new JournalError("公開後のURLは変更できません");
  const keep=existing && (existing.firstPublishedAt || !isPlaceholderSlug(existing.slug)) ? existing.slug : undefined;
  const base=existing?.firstPublishedAt ? existing.slug : requested ?? keep ?? await suggestSlug(draft);
  const withSlug=(slug:string):JournalContent=>contentSchema.parse({...draft,slug,...(draft.kind==="person"?{authorSlug:slug}:{})});
  try {
    return await db.$transaction(async tx => {
      const old=await tx.journalEntry.findUnique({where:{ownerId_externalId:{ownerId:v.id, externalId:input.externalId}}});
      if(old) {
        if(old.kind !== draft.kind) throw new JournalError("作成後のページ種類は変更できません");
        const slug=old.firstPublishedAt||base===old.slug?old.slug:await uniqueSlug(tx,draft.kind,base,old.id), c=withSlug(slug);
        if(stable(old.content) === stable(c)) return old;
        if(input.expectedRevision !== old.revision) throw new JournalError("他の更新があります。記事を読み直してから保存してください",409);
        const changed=await tx.journalEntry.updateMany({where:{id:old.id, revision:old.revision},data:{content:json(c), title:c.title, slug, revision:{increment:1}, status:"DRAFT",reviewNote:null}});
        if(changed.count!==1) throw new JournalError("更新が競合しました。記事を読み直してください",409);
        return tx.journalEntry.findUniqueOrThrow({where:{id:old.id}});
      }
      if(input.expectedRevision) throw new JournalError("更新対象の記事がありません",409);
      const slug=await uniqueSlug(tx,draft.kind,base), c=withSlug(slug);
      return tx.journalEntry.create({data:{id:randomUUID(),ownerId:v.id,ownerName:v.name??v.email,branchId:v.branchId??"branch_hq",groupCompanyId:v.groupCompanyId,externalId:input.externalId,kind:c.kind,slug,title:c.title,content:json(c)}});
    });
  } catch(e) {
    if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002") throw new JournalError("同じURL名の記事が同時に保存されました。もう一度保存してください",409);
    throw e;
  }
}
export async function submit(v:McpViewer,id:string,revision:number) {
  const row=await getEntry(v,id);
  if(row.revision!==revision) throw new JournalError("最新版を読み直してください",409);
  contentSchema.parse(row.content);
  if(row.status==="IN_REVIEW" || row.status==="APPROVED") return row;
  if(row.status==="ARCHIVED") throw new JournalError("原稿を保存し直してから確認を依頼してください");
  const n=await db.journalEntry.updateMany({where:{id,revision,status:row.status},data:{status:"IN_REVIEW"}});
  if(n.count!==1) throw new JournalError("更新が競合しました",409);
  // 本部のOS内通知（ベル）だけ。Chat・メールには出さない。本部が自分で出した原稿は通知しない
  if(v.role!=="ADMIN") {
    const c=row.content as {kind?:string;company?:string};
    await notifyAdmins({type:"SYSTEM",title:`📝 Journalの原稿が届きました：${row.title}`,
      message:`${row.ownerName}${c.company?`（${c.company}）`:""}／${c.kind==="person"?"人物ページ":"記事"}・本部の確認待ち`,
      linkUrl:`/dashboard/admin/journal?id=${row.id}`});
  }
  return getEntry(v,id);
}
export async function review(v:McpViewer,raw:unknown) {
  if(v.role!=="ADMIN") throw new JournalError("本部だけが公開を承認できます",403);
  const a=reviewSchema.parse(raw);
  return db.$transaction(async tx => {
    const row=await tx.journalEntry.findUnique({where:{id:a.id}});
    if(!row) throw new JournalError("記事が見つかりません",404);
    if(row.revision!==a.revision) throw new JournalError("原稿が更新されました。最新版を確認してください",409);
    let c=contentSchema.parse(row.content);
    let data:Prisma.JournalEntryUpdateManyMutationInput;
    if(a.action==="approve") {
      // 本部が自分で書いた下書きは「本部へ渡す」を省いてそのまま承認できる（2026-09-19代表指示）
      if(row.status!=="IN_REVIEW" && !(row.status==="DRAFT" && row.ownerId===v.id)) throw new JournalError("確認待ちの記事を選んでください",409);
      if(!a.factsChecked || !a.rightsChecked || (c.kind==="person" && !a.personChecked)) throw new JournalError("事実・写真と掲載範囲・本人確認を完了してください");
      // 本部は承認時にURL名を直せる。初回の公開承認でURLが固定される。
      let slugData={};
      if(a.slug && a.slug!==row.slug) {
        if(row.firstPublishedAt) throw new JournalError("公開後のURLは変更できません");
        if(await tx.journalEntry.findFirst({where:{kind:row.kind,slug:a.slug}})) throw new JournalError("このURL名はほかの記事で使われています");
        c=contentSchema.parse({...c,slug:a.slug,...(c.kind==="person"?{authorSlug:a.slug}:{})});
        slugData={slug:a.slug,content:json(c)};
      }
      const now=new Date().toISOString();
      data={...slugData,status:"APPROVED",approvedRevision:row.revision,approvedBy:v.id,reviewNote:a.note??null,approvedAt:new Date(),firstPublishedAt:row.firstPublishedAt??new Date(),
        publicSnapshot:json({...publicContent(c),id:row.id,revision:row.revision,path:publicPath(c),datePublished:row.firstPublishedAt?.toISOString()??now,dateModified:now})};
    } else if(a.action==="withdraw") {
      // URLは再利用しない。同期側でnoindexの取り下げページに置換する。
      data={status:"ARCHIVED",revision:{increment:1},approvedRevision:null,publicSnapshot:Prisma.DbNull,reviewNote:a.note??"掲載を取り下げました"};
    } else {
      if(row.status!=="IN_REVIEW") throw new JournalError("確認待ちの記事を選んでください",409);
      data={status:"DRAFT",reviewNote:a.note??"内容の確認をお願いします"};
    }
    const changed=await tx.journalEntry.updateMany({where:{id:row.id,revision:a.revision,status:row.status},data});
    if(changed.count!==1) throw new JournalError("更新が競合しました",409);
    return tx.journalEntry.findUniqueOrThrow({where:{id:row.id}});
  });
}
export async function archiveDrafts(v:McpViewer,ids:string[]) {
  if(!ids.length || ids.length>100) throw new JournalError("1〜100件を選択してください");
  // 公開したことがある記事は削除不可。本部の「掲載を取り下げる」を使う。
  return db.journalEntry.updateMany({where:{id:{in:ids},...scope(v),firstPublishedAt:null,approvedRevision:null},data:{status:"ARCHIVED"}});
}
export async function uploadPhoto(v:McpViewer,base64:string) {
  writer(v);
  if(base64.length>12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new JournalError("写真は8MB以内の画像にしてください");
  const raw=Buffer.from(base64,"base64");
  if(raw.length>8_000_000) throw new JournalError("写真は8MB以内にしてください");
  const img=sharp(raw,{limitInputPixels:40_000_000}); const meta=await img.metadata();
  if(!["jpeg","png","webp","heif"].includes(meta.format??"")) throw new JournalError("JPEG・PNG・WebPの写真を選んでください");
  const data=await img.rotate().resize({width:800,withoutEnlargement:true}).jpeg({quality:82}).toBuffer(); // EXIFは公開しない
  const sha256=createHash("sha256").update(data).digest("hex");
  const row=await db.journalAsset.upsert({where:{ownerId_sha256:{ownerId:v.id,sha256}},update:{},create:{id:randomUUID(),ownerId:v.id,sha256,data:new Uint8Array(data)},select:{id:true,sha256:true}});
  return {assetId:row.id,sha256:row.sha256,previewUrl:`/api/journal/photos/${row.id}`};
}
export async function photo(v:McpViewer,id:string) {
  const row=await db.journalAsset.findFirst({where:{id,...scope(v)}});
  if(!row) throw new JournalError("写真が見つかりません",404);
  return row.data;
}
// トップの「PICK UP」3枠。本部が選んだ記事IDを順番どおりに保存する（2026-09-19代表指示）
const PICKUP_KEY="journal.pickupIds";
async function storedPickup():Promise<string[]> {
  const row=await db.appSetting.findUnique({where:{key:PICKUP_KEY},select:{value:true}});
  try {const v=JSON.parse(row?.value??"[]");return Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[];} catch {return [];}
}
// 「PEOPLE ／ ひとを知る」の1枠。本部が選んだ「ひと」の記事・人物ページ。空なら最新の人物ページ（2026-09-20代表指示）
const PEOPLE_KEY="journal.peopleId";
async function storedPeople():Promise<string> {
  const row=await db.appSetting.findUnique({where:{key:PEOPLE_KEY},select:{value:true}});
  return row?.value??"";
}
export async function getPickup(v:McpViewer) {
  if(v.role!=="ADMIN") throw new JournalError("本部だけが設定できます",403);
  const live=await db.journalEntry.findMany({where:{publicSnapshot:{not:Prisma.DbNull}},select:{id:true,title:true,publicSnapshot:true},orderBy:{firstPublishedAt:"desc"}});
  const peopleChoices=live.filter(r=>(r.publicSnapshot as {category?:string}).category==="ひと").map(r=>({id:r.id,title:r.title}));
  return {ids:await storedPickup(),peopleId:await storedPeople(),peopleChoices};
}
export async function setPickup(v:McpViewer,raw:unknown) {
  if(v.role!=="ADMIN") throw new JournalError("本部だけが設定できます",403);
  const input=z.object({ids:z.array(z.string().uuid()).max(3),peopleId:z.union([z.string().uuid(),z.literal("")]).optional()}).parse(raw);
  const ids=[...new Set(input.ids)];
  const published=await db.journalEntry.count({where:{id:{in:ids},publicSnapshot:{not:Prisma.DbNull}}});
  if(published!==ids.length) throw new JournalError("公開中の記事だけを選んでください");
  if(input.peopleId) {
    const row=await db.journalEntry.findFirst({where:{id:input.peopleId,publicSnapshot:{not:Prisma.DbNull}},select:{publicSnapshot:true}});
    if((row?.publicSnapshot as {category?:string}|null)?.category!=="ひと") throw new JournalError("「ひとを知る」には公開中の「ひと」の記事を選んでください");
  }
  const value=JSON.stringify(ids);
  await db.appSetting.upsert({where:{key:PICKUP_KEY},create:{key:PICKUP_KEY,value},update:{value}});
  if(input.peopleId!==undefined) await db.appSetting.upsert({where:{key:PEOPLE_KEY},create:{key:PEOPLE_KEY,value:input.peopleId},update:{value:input.peopleId}});
  return {ids,peopleId:input.peopleId??await storedPeople()};
}
export async function manifest() {
  const rows=await db.journalEntry.findMany({orderBy:{id:"asc"}});
  const entries=rows.filter(r=>r.publicSnapshot!==null).map(r=>r.publicSnapshot);
  const tombstones=rows.filter(r=>r.firstPublishedAt && !r.publicSnapshot).map(r=>({id:r.id,revision:r.revision,path:publicPath({kind:r.kind as JournalContent["kind"],slug:r.slug})}));
  const assets=[...new Set(entries.flatMap(e=>(e as unknown as {photos:{assetId:string}[]}).photos.map(p=>p.assetId)))];
  const media=await db.journalAsset.findMany({where:{id:{in:assets}},select:{id:true,sha256:true},orderBy:{id:"asc"}});
  const live=new Set(rows.filter(r=>r.publicSnapshot!==null).map(r=>r.id));
  const pickupIds=(await storedPickup()).filter(id=>live.has(id));
  const people=await storedPeople(), peopleId=live.has(people)?people:"";
  const payload={schemaVersion:1,entries,tombstones,media,pickupIds,...(peopleId?{peopleId}:{})};
  return {...payload,version:createHash("sha256").update(JSON.stringify(payload)).digest("hex")};
}
export async function deliveryPhoto(id:string) {
  const m=await manifest();
  if(!m.media.some(a=>a.id===id)) throw new JournalError("写真が見つかりません",404);
  const a=await db.journalAsset.findUnique({where:{id}}); if(!a) throw new JournalError("写真が見つかりません",404);
  return a.data;
}
export async function acknowledge(version:string) {
  const m=await manifest();
  if(version!==m.version) throw new JournalError("同期中に新しい記事が承認されました。次の同期で反映します",409);
  for(const item of m.entries) {const e=item as unknown as {id:string,revision:number}; await db.journalEntry.updateMany({where:{id:e.id,approvedRevision:e.revision},data:{deliveredRevision:e.revision,deliveredAt:new Date()}});}
  for(const e of m.tombstones) await db.journalEntry.updateMany({where:{id:e.id,revision:e.revision,approvedRevision:null},data:{deliveredRevision:e.revision,deliveredAt:new Date()}});
  return {version,delivered:m.entries.length};
}
