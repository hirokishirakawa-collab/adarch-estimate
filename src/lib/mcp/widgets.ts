// ==============================================================
// ChatGPT Apps SDK 用ウィジェット（MCP resource・mimeType text/html+skybridge）
//   ツール結果（structuredContent）を window.openai.toolOutput で受け取り、チャット内にカードで描く。
//   Claude 側はこの資源を使わないので、登録しておいても害はない。
//   見た目はブランドの決まり（2026-09-04・橙は合図だけ）に合わせる。
// ==============================================================

const CSS = `
:root{--p:#ffffff;--alt:#f7f6f4;--k:#111111;--s:#6a6a6a;--rule:#e6e4e0;--ac:#f19834;--ac2:#d97f18}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:var(--k);background:var(--p);font-size:13px;line-height:1.55}
.card{border:1px solid var(--rule);border-radius:10px;padding:14px 16px;max-width:640px}
.h{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}.h b{font-size:15px}.tag{font-size:11px;color:var(--ac2);border:1px solid var(--ac);border-radius:999px;padding:1px 8px}
.s{color:var(--s);font-size:12px}.row{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0}.row div{min-width:120px}.row small{display:block;color:var(--s);font-size:11px}
.box{background:var(--alt);border-radius:8px;padding:8px 10px;margin-top:8px;white-space:pre-wrap}
ul{margin:6px 0 0;padding-left:18px}li{margin:2px 0}.sec{border-top:1px solid var(--rule);padding-top:8px;margin-top:8px}
.n{display:inline-block;width:18px;height:18px;border-radius:50%;background:var(--k);color:#fff;text-align:center;font-size:11px;line-height:18px;margin-right:6px}
.muted{color:var(--s)}.foot{border-top:1px solid var(--rule);margin-top:10px;padding-top:6px;font-size:11px;color:var(--s)}
`;

export const DEAL_CARD_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="card" id="root"><span class="muted">読み込み中…</span></div>
<script>
(function(){
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var STATUS={PROSPECTING:"声かけ",QUALIFYING:"検討中",PROPOSAL:"提案中",NEGOTIATION:"交渉中",CLOSED_WON:"受注",CLOSED_LOST:"失注",DORMANT:"休眠",DEFERRED:"保留"};
  function render(){
    var d=(window.openai&&window.openai.toolOutput)||{};
    if(d.deal)d=d.deal;
    var root=document.getElementById("root");
    if(!d||!d.id){root.innerHTML='<span class="muted">商談が見つかりません</span>';return}
    var logs=(d.logs||[]).slice(0,5).map(function(l){return '<li><span class="muted">'+esc(l.at||"")+' '+esc(l.type||"")+'</span> '+esc((l.content||"").slice(0,140))+'</li>'}).join("");
    root.innerHTML=
      '<div class="h"><b>'+esc(d.customer&&d.customer.name||"")+'</b><span class="tag">'+esc(STATUS[d.status]||d.status||"")+'</span></div>'+
      '<div class="s">'+esc(d.title||"")+' ／ '+esc(d.branch||"")+(d.assignedTo?' ／ 担当 '+esc(d.assignedTo):'')+'</div>'+
      '<div class="row"><div><small>受注確度</small>'+(d.probability!=null?esc(d.probability)+'%':'—')+'</div><div><small>見込み日</small>'+esc(d.expectedCloseDate||"—")+'</div><div><small>金額</small>'+esc(d.amount||"—")+'</div></div>'+
      (d.closingFactor?'<div class="box"><b>決め手</b>\\n'+esc(d.closingFactor)+'</div>':'')+
      (d.notes?'<div class="box">'+esc(d.notes.slice(0,600))+'</div>':'')+
      (logs?'<div class="sec"><b>最近の動き</b><ul>'+logs+'</ul></div>':'')+
      '<div class="foot">Ad Arch OS ／ 受注の確定はOS画面で</div>';
  }
  render();
  window.addEventListener("openai:set_globals",render);
})();
</script></body></html>`;

export const NEXT_ACTIONS_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="card" id="root"><span class="muted">読み込み中…</span></div>
<script>
(function(){
  var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  function line(it){
    var name=it.customer||it.name||it.title||"";
    var sub=[it.title&&it.customer?it.title:null,it.industry,it.daysWaiting!=null?'返事待ち '+it.daysWaiting+'日':null,it.daysOver!=null?'期限超過 '+it.daysOver+'日':null,it.daysIdle!=null?'停止 '+it.daysIdle+'日':null,it.anniversary?it.anniversary+'（'+it.monthsAway+'か月後）':null,it.signal?'シグナル: '+it.signal:null,it.institution?it.institution:null,it.acceptanceEnd?'締切 '+it.acceptanceEnd:null].filter(Boolean).join(" ／ ");
    return '<li><b>'+esc(name)+'</b>'+(sub?' <span class="muted">'+esc(sub)+'</span>':'')+'</li>';
  }
  function render(){
    var d=(window.openai&&window.openai.toolOutput)||{};
    var root=document.getElementById("root");
    if(!d.sections){root.innerHTML='<span class="muted">材料がありません</span>';return}
    var head='<div class="h"><b>今日の一手</b><span class="s">'+esc(d.for&&d.for.company||"")+(d.for&&d.for.name?' ／ '+esc(d.for.name):'')+' ／ '+esc(d.asOf||"")+'</span></div>';
    var body=d.sections.map(function(s){
      if(!s.count)return '';
      return '<div class="sec"><span class="n">'+esc(s.no)+'</span><b>'+esc(s.title)+'</b> <span class="muted">'+esc(s.count)+'件</span><ul>'+s.items.slice(0,5).map(line).join("")+'</ul></div>';
    }).join("");
    root.innerHTML=head+(body||'<div class="muted">今日は急ぎの項目がありません</div>')+'<div class="foot">1→6 の順に優先 ／ 金額は含まない</div>';
  }
  render();
  window.addEventListener("openai:set_globals",render);
})();
</script></body></html>`;
