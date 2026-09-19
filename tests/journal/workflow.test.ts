import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSchema, publicContent, publicPath } from "../../src/lib/journal/model";
import { parseFinalDraft } from "../../src/lib/journal/plain-draft";
import { saveDraft,submit,review,getEntry,manifest,acknowledge,archiveDrafts } from "../../src/lib/journal/service";
import type { McpViewer } from "../../src/lib/mcp/os-read-tools";

// SQLは別途ステージングDBで検証する。ここでは本番DBに接続せず実サービスの権限・状態遷移を通す。
type RecordRow=Record<string,unknown>;
const rows:RecordRow[]=[];
const notices:RecordRow[]=[];
function matches(row:RecordRow,w:RecordRow={}){return Object.entries(w).every(([k,v])=>v&&typeof v==="object"&&"in" in v ? (v as {in:unknown[]}).in.includes(row[k]):row[k]===v);}
const store={
  journalEntry:{
    async findFirst({where}:{where:RecordRow}){return structuredClone(rows.find(r=>matches(r,where))??null);},
    async findUnique({where}:{where:RecordRow}){return this.findFirst({where:(where.ownerId_externalId??where) as RecordRow});},
    async findUniqueOrThrow(a:{where:RecordRow}){const r=await this.findUnique(a);if(!r)throw Error("missing");return r;},
    async findMany(){return structuredClone(rows);},
    async create({data}:{data:RecordRow}){const r={status:"DRAFT",revision:1,approvedRevision:null,publicSnapshot:null,firstPublishedAt:null,deliveredRevision:null,createdAt:new Date(),updatedAt:new Date(),...data};rows.push(r);return structuredClone(r);},
    async updateMany({where,data}:{where:RecordRow,data:RecordRow}){let count=0;for(const r of rows)if(matches(r,where)){for(const[k,v]of Object.entries(data)){r[k]=v&&typeof v==="object"&&"increment"in v?Number(r[k])+Number(v.increment):v&&typeof v==="object"&&v.constructor.name==="DbNull"?null:v;}count++;}return{count};},
  },
  journalAsset:{async count(){return 0;},async findMany(){return[];}},
  user:{async findMany(){return [{id:"hq"}];}},
  notification:{async createMany({data}:{data:RecordRow[]}){notices.push(...data);return {count:data.length};}},
  async $transaction<T>(fn:(s:unknown)=>Promise<T>):Promise<T>{return fn(store);},
};
(globalThis as unknown as {prisma:unknown}).prisma=store;
const owner:McpViewer={id:"one",name:"テスト投稿者",email:"test@example.invalid",role:"MANAGER",branchId:"local",branchId2:null,groupCompanyId:"company-one"};
const other={...owner,id:"two"},admin={...owner,id:"hq",role:"ADMIN" as const};
const content={kind:"article" as const,slug:"fixture-story",title:"検証用の記事",summary:"これは公開しないテストデータです。",category:"まちの広告" as const,genre:"こんな仕事をしました" as const,region:"検証用",area:"全国" as const,company:"検証用会社",authorName:"テスト投稿者",blocks:[{type:"paragraph" as const,text:"本番の実績ではありません。テストデータです。"}],photos:[],evidence:[{label:"内部根拠",reference:"private://evidence",note:"社外非公開"}],publicSources:[],aiAssisted:true};

test("最終原稿の貼り付けはタイトル・H2・段落・引用を保持し、HTMLを実行しない",()=>{
 const draft=parseFinalDraft("# 最終タイトル\r\n\r\n## 地域での仕事\r\n本文の1行目\r\n2行目\r\n\r\n> 本人の言葉\r\n\r\n<script>text</script>");
 assert.equal(draft.title,"最終タイトル");
 assert.deepEqual(draft.blocks,[{type:"heading",text:"地域での仕事"},{type:"paragraph",text:"本文の1行目\n2行目"},{type:"quote",text:"本人の言葉"},{type:"paragraph",text:"<script>text</script>"}]);
 assert.deepEqual(parseFinalDraft("普通の原稿\n\n次の段落"),{blocks:[{type:"paragraph",text:"普通の原稿"},{type:"paragraph",text:"次の段落"}]});
 assert.deepEqual(parseFinalDraft("   ").blocks,[]);
});
test("入力形式・URL制約・人物の本人写真必須",()=>{
 assert.equal(contentSchema.parse(content).slug,"fixture-story");
 assert.throws(()=>contentSchema.parse({...content,slug:"../../outside"}));
 assert.throws(()=>contentSchema.parse({...content,kind:"person",category:"ひと",authorSlug:"fixture-story"}));
 assert.throws(()=>contentSchema.parse({...content,publicSources:[{label:"bad",url:"javascript:alert(1)"}]}));
 assert.throws(()=>contentSchema.parse({...content,secret:"extra"}));
 assert.equal(publicPath(content),"/journal/fixture-story/");assert.ok(!("evidence"in publicContent(content)));
});
test("保存→本人提出→本部承認→修正中は旧版維持→再承認→取り下げ",async()=>{
 rows.length=0;
 const first=await saveDraft(owner,{externalId:"fixture",content});
 assert.equal(first.revision,1);
 const retry=await saveDraft(owner,{externalId:"fixture",content:{...content,title:content.title}});assert.equal(retry.id,first.id);assert.equal(retry.revision,1);
 await assert.rejects(()=>getEntry(other,first.id),/見つかりません/);
 await assert.rejects(()=>saveDraft({...owner,branchId:null},{externalId:"bad",content}),/拠点/);
 await assert.rejects(()=>review(other,{id:first.id,revision:1,action:"approve",factsChecked:true,rightsChecked:true}),/本部/);
 assert.equal((await manifest()).entries.length,0);
 await submit(owner,first.id,1);
 await assert.rejects(()=>review(admin,{id:first.id,revision:1,action:"approve"}),/事実/);
 await review(admin,{id:first.id,revision:1,action:"approve",factsChecked:true,rightsChecked:true});
 let m=await manifest();assert.equal(m.entries.length,1);assert.ok(!JSON.stringify(m).includes("private://"));
 await acknowledge(m.version);
 assert.equal((await getEntry(owner,first.id)).deliveredRevision,1);
 await assert.rejects(()=>saveDraft(owner,{externalId:"fixture",expectedRevision:5,content:{...content,title:"更新"}}),/他の更新/);
 const next=await saveDraft(owner,{externalId:"fixture",expectedRevision:1,content:{...content,title:"修正したタイトル"}});assert.equal(next.revision,2);
 m=await manifest();assert.equal((m.entries[0] as {title:string}).title,content.title);
 assert.equal((await archiveDrafts(owner,[first.id])).count,0);
 await submit(owner,first.id,2);
 await assert.rejects(()=>review(admin,{id:first.id,revision:1,action:"approve",factsChecked:true,rightsChecked:true}),/最新版/);
 await review(admin,{id:first.id,revision:2,action:"approve",factsChecked:true,rightsChecked:true});
 await assert.rejects(()=>acknowledge(m.version),/同期中/);
 m=await manifest();assert.equal((m.entries[0] as {title:string}).title,"修正したタイトル");
 await review(admin,{id:first.id,revision:2,action:"withdraw"});
 m=await manifest();assert.equal(m.entries.length,0);assert.equal(m.tombstones.length,1);
});
test("URL名：省略時はOSが付け、重複は番号付き、承認まで変更可・公開後は固定",async()=>{
 rows.length=0; delete process.env.ANTHROPIC_API_KEY;
 const {slug:_omit,...noSlug}=content; void _omit;
 const auto=await saveDraft(owner,{externalId:"auto",content:noSlug});
 assert.match(auto.slug as string,/^article-[0-9a-f]{8}$/);
 const legacy=await saveDraft(owner,{externalId:"legacy",content:{...content,slug:"story-1a2b3c4d"}});
 assert.notEqual(legacy.slug,"story-1a2b3c4d");
 const a=await saveDraft(owner,{externalId:"dup-a",content:{...content,slug:"seki-tver-cm"}});
 const b=await saveDraft(other,{externalId:"dup-b",content:{...content,slug:"seki-tver-cm"}});
 assert.equal(a.slug,"seki-tver-cm");assert.equal(b.slug,"seki-tver-cm-2");
 const kept=await saveDraft(owner,{externalId:"dup-a",expectedRevision:1,content:{...noSlug,title:"タイトル変更"}});
 assert.equal(kept.slug,"seki-tver-cm");
 const renamed=await saveDraft(owner,{externalId:"dup-a",expectedRevision:2,content:{...content,slug:"seki-cm-shooting"}});
 assert.equal(renamed.slug,"seki-cm-shooting");assert.equal((renamed.content as {slug:string}).slug,"seki-cm-shooting");
 await submit(owner,renamed.id as string,3);
 await assert.rejects(()=>review(admin,{id:renamed.id,revision:3,action:"approve",factsChecked:true,rightsChecked:true,slug:"seki-tver-cm-2"}),/使われています/);
 const approved=await review(admin,{id:renamed.id,revision:3,action:"approve",factsChecked:true,rightsChecked:true,slug:"seki-tver-cm-shooting"});
 assert.equal(approved.slug,"seki-tver-cm-shooting");
 assert.equal((approved.publicSnapshot as {path:string}).path,"/journal/seki-tver-cm-shooting/");
 await assert.rejects(()=>saveDraft(owner,{externalId:"dup-a",expectedRevision:3,content:{...content,slug:"another-url"}}),/公開後/);
 const afterPublish=await saveDraft(owner,{externalId:"dup-a",expectedRevision:3,content:{...noSlug,title:"公開後の修正"}});
 assert.equal(afterPublish.slug,"seki-tver-cm-shooting");
});
test("URL名の整形",async()=>{
 const {normalizeSlug}=await import("../../src/lib/journal/slug");
 assert.equal(normalizeSlug(" Seki TVer_CM Shooting! "),"seki-tver-cm-shooting");
 assert.equal(normalizeSlug("people"),null);assert.equal(normalizeSlug("関市"),null);
});
test("本部の確認待ちになったら本部にOS内通知（本部自身の提出は通知しない）",async()=>{
 rows.length=0;notices.length=0;
 const a=await saveDraft(owner,{externalId:"notice-a",content:{...content,slug:"notice-a"}});
 await submit(owner,a.id as string,1);
 assert.equal(notices.length,1);
 assert.match(String(notices[0].title),/Journalの原稿が届きました/);
 assert.equal(notices[0].userId,"hq");assert.equal(notices[0].linkUrl,`/dashboard/admin/journal?id=${a.id}`);
 await submit(owner,a.id as string,1);assert.equal(notices.length,1);
 const b=await saveDraft(admin,{externalId:"notice-b",content:{...content,slug:"notice-b"}});
 await submit(admin,b.id as string,1);assert.equal(notices.length,1);
});
