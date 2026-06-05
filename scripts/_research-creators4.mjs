// 使い捨て: 第4弾リサーチ。/freelance?search= フリーワード検索で新規発掘→フリーアドレスのみ精査
import fs from "node:fs";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SEEN = new Set([
  "7680","151","1310","7663","7654","3373","764","2613","4097","4528",
  "4385","1754","3973","4237","440","975","4800","3823","1870","2988",
  "680","5129","4449","2507","4284","4560","7526","4017","1485",
]);

// 商売寄りキーワードでフリーワード検索（カテゴリ縛りを外す）
const QUERIES = ["広告運用","マーケティング","集客","SNS運用代行","YouTube運用","動画広告","販促"];
const FREE = /@(gmail\.com|icloud\.com|yahoo\.co\.jp|outlook\.|hotmail\.|me\.com|ezweb|docomo|softbank)/i;
const BIZ = ["売上","集客","広告運用","運用代行","マーケ","成果","採用","継続","月額","法人","企業","代理店","販促","リスティング","SNS運用","コンサル","戦略"];
const ART = ["作品","アート","世界観","表現","映画祭","個展","受賞","映画","ブライダル","結婚式","副業"];
const EXCL_PREF = ["沖縄","山口","香川"];

async function searchIds(q){
  const r = await fetch(`https://freelance-meikan.com/freelance?search=${encodeURIComponent(q)}`,{headers:{"User-Agent":UA,"Accept-Language":"ja"}});
  const h = await r.text();
  return [...new Set([...h.matchAll(/\/freelance\/(\d+)/g)].map(m=>m[1]))];
}
function ogdesc(h){let m=h.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i)||h.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);return m?m[1].replace(/&amp;/g,"&"):"";}
async function profile(id){
  const r = await fetch(`https://freelance-meikan.com/freelance/${id}`,{headers:{"User-Agent":UA,"Accept-Language":"ja"}});
  const h = await r.text();
  const t=(h.match(/<title>([^<]*)<\/title>/)||[])[1]||"";
  const name=t.replace("のプロフィール｜フリーランス名鑑","").trim();
  const body=h.replace(/<script[\s\S]*?<\/script>/g," ").replace(/<[^>]+>/g," ");
  const pmatch=body.match(/在住都道府県\s*([^\s　]{2,4}[都道府県])/);
  const pref=pmatch?pmatch[1]:"不明";
  // 対応業務（職種ラベル）
  const job=(body.match(/職種\s*([^\s　]{2,30})/)||[])[1]||"";
  const mails=[...new Set((h.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)||[]))]
    .filter(m=>!/example\.|sentry|w3\.org|googleapis|gstatic|\.png|\.jpg|noreply|stock-sun/.test(m));
  const freeMail=mails.find(m=>FREE.test(m));
  const stocksun=mails.some(m=>/@stock-sun\.com$/i.test(m)) || (h.match(/[a-zA-Z0-9._%+-]+@stock-sun\.com/)!==null);
  const biz=BIZ.filter(w=>body.includes(w)).length;
  const art=ART.filter(w=>body.includes(w));
  const status=(body.match(/(◎現在対応可能|○対応可能|副業で対応可能|未登録)/)||[])[1]||"不明";
  return {id,name,pref,job,mails,freeMail,stocksun,biz,art,status};
}

const out=[];const emit=s=>{out.push(s);fs.writeFileSync("/tmp/creator-research4.txt",out.join("\n"));};
const found=new Set();
for(const q of QUERIES){
  let ids;try{ids=await searchIds(q);}catch{emit(`\n## search "${q}": 失敗`);continue;}
  const fresh=ids.filter(id=>!SEEN.has(id)&&!found.has(id));
  emit(`\n===== search "${q}"（新規${fresh.length}/${ids.length}件）=====`);
  for(const id of fresh){
    found.add(id);
    try{
      const p=await profile(id);
      const excl=EXCL_PREF.some(x=>p.pref.includes(x));
      let verdict;
      if(p.stocksun) verdict="🚫stock-sun";
      else if(!p.freeMail && p.mails.length) verdict="🔻独自ドメイン(スルー)";
      else if(!p.mails.length) verdict="△メール非公開";
      else if(excl) verdict="⚠除外県";
      else if(p.art.includes("副業")) verdict="🔻副業";
      else if(p.art.length>=3) verdict="△作家寄り";
      else verdict="◎候補";
      emit(`\n[${id}] ${p.name} ${verdict} 在住:${p.pref} 商売${p.biz}/作家${p.art.length} 稼働:${p.status}`);
      emit(`  職種: ${p.job}`);
      emit(`  メール: ${p.mails.join(", ")||"(非公開)"}  ${p.freeMail?"→フリー:"+p.freeMail:""}`);
      emit(`  URL: https://freelance-meikan.com/freelance/${id}`);
    }catch(e){emit(`\n[${id}] 失敗`);}
  }
}
emit(`\n[DONE] 新規${found.size}件精査`);console.log("DONE4 "+found.size);
