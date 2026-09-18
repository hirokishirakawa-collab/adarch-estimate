"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated photo previews use the session cookie. */
import { useRef, useState } from "react";
import { categories, genres, contentSchema, type JournalContent } from "@/lib/journal/model";
import { parseFinalDraft } from "@/lib/journal/plain-draft";
import styles from "./desk.module.css";

export type EditableEntry={id:string;externalId:string;revision:number;content:JournalContent};
export type AuthorDefaults=Pick<JournalContent,"authorName"|"company"|"region">;
type Props={defaults?:AuthorDefaults;entry:EditableEntry|null;onSaved:(id:string)=>Promise<void>;onDirty:()=>void;photoUrl:(id:string)=>string};
const areas=["全国","北海道・東北","関東","甲信越・北陸","東海","関西","中国・四国","九州・沖縄"] as const;
const empty=(defaults?:AuthorDefaults):JournalContent=>({kind:"article",slug:`story-${crypto.randomUUID().slice(0,8)}`,title:"",summary:"",category:"まちの広告",genre:"こんな仕事をしました",region:defaults?.region??"",area:"全国",company:defaults?.company??"",authorName:defaults?.authorName??"",blocks:[],photos:[],evidence:[{label:"確認のための資料",reference:"投稿者が提供した最終原稿・写真",note:"掲載内容・担当範囲は公開前に本部で確認してください。"}],publicSources:[],aiAssisted:false});
const labels:Record<string,string>={title:"記事タイトル",summary:"記事の紹介文",slug:"記事のURL",region:"地域",company:"会社名",authorName:"お名前",photos:"写真",blocks:"見出し・本文",evidence:"確認資料",publicSources:"公開する参考リンク",authorSlug:"人物ページのURL名",occurredOn:"実施時期"};

const plain=(blocks:JournalContent["blocks"])=>blocks.map(b=>b.type==="heading"?`## ${b.text}`:b.type==="quote"?b.text.split("\n").map(line=>`> ${line}`).join("\n"):b.text).join("\n\n");

export default function JournalEditor({entry,onSaved,onDirty,photoUrl,defaults}:Props){
  const [content,setContent]=useState<JournalContent>(()=>entry?.content??empty(defaults));
  const [externalId]=useState(()=>entry?.externalId??`web-${crypto.randomUUID()}`);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[bodyText,setBodyText]=useState(()=>plain(entry?.content.blocks??[])),[settingsOpen,setSettingsOpen]=useState(false);
  const bodyRef=useRef<HTMLTextAreaElement>(null);
  function update(next:JournalContent){if(next.blocks!==content.blocks)setBodyText(plain(next.blocks));setContent(next);onDirty();}
  function writeBody(value:string){setBodyText(value);const parsed=parseFinalDraft(value);setContent({...content,blocks:parsed.blocks,...(parsed.title?{title:parsed.title}:{})});onDirty();}
  function insertHeading(){const node=bodyRef.current,at=node?.selectionStart??bodyText.length;const addition=`${at?"\n\n":""}## 見出し\n`;writeBody(bodyText.slice(0,at)+addition+bodyText.slice(at));requestAnimationFrame(()=>{node?.focus();const start=at+(at?2:0)+3;node?.setSelectionRange(start,start+3);});}
  function field<K extends keyof JournalContent>(key:K,value:JournalContent[K]){update({...content,[key]:value});}
  function block(index:number,value:Partial<JournalContent["blocks"][number]>){field("blocks",content.blocks.map((b,i)=>i===index?{...b,...value}:b));}
  function move(index:number,offset:number){const blocks=[...content.blocks];[blocks[index],blocks[index+offset]]=[blocks[index+offset],blocks[index]];field("blocks",blocks);}
  async function addPhotos(files:File[]){
    setError("");
    if(content.photos.length+files.length>12){setError("写真は1記事12枚までです。");return;}
    setBusy(true);
    try{
      for(const f of files){
        if(f.size>8_000_000)throw Error(`${f.name} は8MBを超えています。`);
        const form=new FormData();form.set("photo",f);
        const r=await fetch("/api/journal/photos",{method:"POST",body:form});const p=await r.json();
        if(!r.ok)throw Error(p.error??"写真を登録できませんでした。");
        setContent(c=>c.photos.some(a=>a.assetId===p.assetId)?c:{...c,photos:[...c.photos,{assetId:p.assetId,alt:"",caption:"",credit:""}]});onDirty();
      }
    }catch(e){setError(e instanceof Error?e.message:"写真を登録できませんでした。");}finally{setBusy(false);}
  }
  async function save(){
    setError("");
    const blocks=parseFinalDraft(bodyText).blocks;
    const value={...content,blocks,summary:content.summary.trim()||(blocks.find(b=>b.type==="paragraph")?.text??content.title).slice(0,200),photos:content.photos.map(p=>({...p,caption:p.caption.trim()||content.title,alt:p.alt.trim()||p.caption.trim()||content.title,credit:p.credit.trim()||"投稿者提供"})),authorSlug:content.kind==="person"?content.slug:content.authorSlug||undefined,position:content.position||undefined,occurredOn:content.occurredOn||undefined};
    const parsed=contentSchema.safeParse(value);
    if(!parsed.success){setSettingsOpen(true);setError(parsed.error.issues.map(i=>`${labels[String(i.path[0])]??"入力内容"}：${i.message}`).join("\n"));return;}
    setBusy(true);
    try{
      const r=await fetch("/api/journal/entries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({externalId,expectedRevision:entry?.revision,content:parsed.data})});
      const result=await r.json();if(!r.ok)throw Error(result.error??"下書きを保存できませんでした。");
      await onSaved(result.id);
    }catch(e){setError(e instanceof Error?e.message:"保存できませんでした。");}finally{setBusy(false);}
  }
  return <form className={styles.editor} noValidate onSubmit={e=>{e.preventDefault();void save();}}>
    <div className={styles.editorHeading}><div><p className={styles.hint}>{entry?"原稿を編集":"新しい記事"}</p><h2>記事を書く</h2></div><span className={styles.hint}>保存しただけでは公開されません</span></div>
    <fieldset disabled={busy}>
      <label className={styles.titleField}>タイトル<input required maxLength={120} value={content.title} placeholder="どんな話か、ひと目で伝わるタイトルに" onChange={e=>field("title",e.target.value)}/></label>
      <section className={styles.editorSection} aria-labelledby="article-photos-heading">
        <div className={styles.sectionHeading}><h3 id="article-photos-heading">写真</h3><span className={styles.hint}>先頭の1枚がトップ画像になります</span></div>
        <div className={styles.uploadArea}><label>写真を登録<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value="";if(files.length)void addPhotos(files);}}/></label><p className={styles.hint}>顔写真・仕事中・地元の風景など。JPEG / PNG / WebP、1枚8MB以内・12枚まで。</p></div>
        {content.photos.map((p,i)=><div className={styles.photoEditor} key={p.assetId}><figure><img src={photoUrl(p.assetId)} alt={p.alt||"登録した写真"}/><figcaption>{i===0?"トップ画像":`写真 ${i+1}`}</figcaption></figure><details className={styles.photoFields}><summary>写真の説明・提供元（任意）</summary>
          <label>写真{i+1}のキャプション<input required maxLength={300} value={p.caption} placeholder="いつ・どこで・何をしている写真か" onChange={e=>field("photos",content.photos.map((a,n)=>n===i?{...a,caption:e.target.value}:a))}/></label>
          <label>写真{i+1}の説明（代替テキスト）<input required maxLength={200} value={p.alt} placeholder="写真が見えない場合にも内容が伝わる説明" onChange={e=>field("photos",content.photos.map((a,n)=>n===i?{...a,alt:e.target.value}:a))}/></label>
          <label>写真{i+1}の撮影者・提供元<input required maxLength={150} value={p.credit} placeholder="撮影者名、会社名など" onChange={e=>field("photos",content.photos.map((a,n)=>n===i?{...a,credit:e.target.value}:a))}/></label>
          <div className={styles.inlineTools}>{i>0&&<button type="button" onClick={()=>field("photos",[p,...content.photos.filter((_,n)=>n!==i)])}>トップ画像にする</button>}<button type="button" onClick={()=>field("photos",content.photos.filter((_,n)=>n!==i))}>記事から外す</button></div>
        </details></div>)}
      </section>
      <section className={styles.editorSection} aria-labelledby="article-body-heading">
        <div className={styles.sectionHeading}><h3 id="article-body-heading">本文</h3><button type="button" onClick={insertHeading}>＋ 見出し</button></div>
        <label className={styles.hint}>最終原稿を貼り付ける<textarea ref={bodyRef} className={styles.writingArea} aria-label="最終原稿" value={bodyText} maxLength={200000} placeholder="ここに文章をそのまま貼り付けるか、直接書いてください。" onChange={e=>writeBody(e.target.value)}/></label>
        <details><summary>見出し・引用を細かく整える</summary>
        {content.blocks.map((b,i)=><div className={styles.blockEditor} key={i}>
          <div className={styles.blockTools}><label>段落{i+1}の種類<select value={b.type} onChange={e=>block(i,{type:e.target.value as typeof b.type})}><option value="heading">見出し（H2）</option><option value="paragraph">本文</option><option value="quote">本人の言葉・引用</option></select></label><div className={styles.inlineTools}><button type="button" aria-label={`段落${i+1}を上へ`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button type="button" aria-label={`段落${i+1}を下へ`} disabled={i===content.blocks.length-1} onClick={()=>move(i,1)}>↓</button><button type="button" disabled={content.blocks.length===1} onClick={()=>field("blocks",content.blocks.filter((_,n)=>n!==i))}>段落を削除</button></div></div>
          <label>{b.type==="heading"?`見出し（H2）${i+1}`:b.type==="quote"?`引用 ${i+1}`:`本文 ${i+1}`}{b.type==="heading"?<input required value={b.text} maxLength={6000} placeholder="この段落で伝えたいこと" onChange={e=>block(i,{text:e.target.value})}/>:<textarea required value={b.text} maxLength={6000} placeholder={b.type==="quote"?"本人が話した言葉・確認できる引用を入力":"実際の出来事や工夫を、身近な言葉で"} onChange={e=>block(i,{text:e.target.value})}/>}</label>
        </div>)}
        <div className={styles.inlineTools}>{([['heading','＋ 見出し（H2）'],['paragraph','＋ 本文'],['quote','＋ 引用']] as const).map(([type,label])=><button type="button" key={type} disabled={content.blocks.length>=80} onClick={()=>field("blocks",[...content.blocks,{type,text:""}])}>{label}</button>)}</div>
        </details>
      </section>
      <details open={settingsOpen} onToggle={e=>setSettingsOpen(e.currentTarget.open)} className={styles.settings}><summary>記事情報・出典・公開設定</summary>
      <label>記事の紹介文<textarea className={styles.shortText} required maxLength={240} value={content.summary} placeholder="一覧に表示する、この記事の短い紹介文" onChange={e=>field("summary",e.target.value)}/></label>
      <section className={styles.editorSection}><h3>記事の情報</h3><div className={styles.editorGrid}>
        <label>ページの種類<select disabled={!!entry} value={content.kind} onChange={e=>update({...content,kind:e.target.value as JournalContent["kind"],...(e.target.value==="person"?{category:"ひと",genre:"代表の素顔"}:{})})}><option value="article">仕事・地域の記事</option><option value="person">代表・人物の紹介</option></select></label>
        <label>記事の種類<select value={content.genre} onChange={e=>field("genre",e.target.value as JournalContent["genre"])}>{genres.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>カテゴリー<select disabled={content.kind==="person"} value={content.category} onChange={e=>field("category",e.target.value as JournalContent["category"])}>{categories.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>地方<select value={content.area} onChange={e=>field("area",e.target.value as JournalContent["area"])}>{areas.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>地域・まち<input required maxLength={80} value={content.region} placeholder="例：岐阜県関市" onChange={e=>field("region",e.target.value)}/></label>
        <label>会社名<input required maxLength={120} value={content.company} onChange={e=>field("company",e.target.value)}/></label>
        <label>お名前<input required maxLength={80} value={content.authorName} onChange={e=>field("authorName",e.target.value)}/></label>
        <label>肩書き（任意）<input maxLength={100} value={content.position??""} onChange={e=>field("position",e.target.value)}/></label>
        <label>実施時期（任意）<input value={content.occurredOn??""} placeholder="2026-09 または 2026-09-19" pattern="\d{4}(-\d{2}(-\d{2})?)?" onChange={e=>field("occurredOn",e.target.value)}/></label>
        <label>記事のURL名（半角英数字）<input required disabled={!!entry} value={content.slug} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例：seki-shooting-story" onChange={e=>field("slug",e.target.value)}/></label>
        {content.kind==="article"&&<label>執筆者の人物ページURL名（任意）<input value={content.authorSlug??""} placeholder="公開済みの人物ページがある場合" onChange={e=>field("authorSlug",e.target.value)}/></label>}
      </div><p className={styles.hint}>公開先：/journal/{content.kind==="person"?"people/":""}{content.slug||"記事のURL名"}/　保存後はURL名とページの種類を固定します。</p></section>
      <section className={styles.editorSection}><h3>本部が内容を確認するための資料</h3><p className={styles.hint}>この欄は一般公開されません。元の制作物、担当者の回答、確認した事実などを残します。</p>
        {content.evidence.map((s,i)=><div className={styles.blockEditor} key={i}>{(['label','reference','note'] as const).map((k,n)=><label key={k}>{['資料の名前','参照先・確認した相手','確認できたこと'][n]}{i+1}<input required maxLength={k==="label"?200:2000} value={s[k]} onChange={e=>field("evidence",content.evidence.map((a,j)=>j===i?{...a,[k]:e.target.value}:a))}/></label>)}{i>0&&<button type="button" onClick={()=>field("evidence",content.evidence.filter((_,j)=>j!==i))}>この資料を外す</button>}</div>)}
        <button type="button" disabled={content.evidence.length>=30} onClick={()=>field("evidence",[...content.evidence,{label:"",reference:"",note:""}])}>＋ 確認資料</button>
      </section>
      <details><summary>読者に公開する参考リンク（任意）</summary>{content.publicSources.map((s,i)=><div className={styles.editorGrid} key={i}><label>参考リンクの名前{i+1}<input required maxLength={200} value={s.label} onChange={e=>field("publicSources",content.publicSources.map((a,j)=>j===i?{...a,label:e.target.value}:a))}/></label><label>参考URL{i+1}<input required type="url" value={s.url} placeholder="https://" onChange={e=>field("publicSources",content.publicSources.map((a,j)=>j===i?{...a,url:e.target.value}:a))}/></label><button type="button" onClick={()=>field("publicSources",content.publicSources.filter((_,j)=>j!==i))}>リンクを外す</button></div>)}<button type="button" disabled={content.publicSources.length>=20} onClick={()=>field("publicSources",[...content.publicSources,{label:"",url:""}])}>＋ 参考リンク</button></details>
      </details>
      {error&&<p role="alert" className={styles.message}>{error}</p>}
      <div className={styles.saveBar}><button className={styles.primary} type="submit">{busy?"保存しています…":"下書きを保存して、内容を確認"}</button><span className={styles.hint}>保存後、原稿を読んで本部へ提出できます。</span></div>
    </fieldset>
  </form>;
}
