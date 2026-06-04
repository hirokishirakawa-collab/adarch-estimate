"use server";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEAD_STATUS_OPTIONS, SCORE_ITEMS, getLeadSourceOption } from "@/lib/constants/leads";
import type { LeadStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// GET /api/leads/export?format=csv|pdf&status=...&industry=...&area=...&q=...
// ---------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "csv";
  const idsParam = params.get("ids") ?? "";
  const q = params.get("q")?.trim() ?? "";
  const statusParam = params.get("status") ?? "";
  const industryParam = params.get("industry") ?? "";
  const areaParam = params.get("area") ?? "";

  // WHERE 条件
  type WhereInput = {
    id?: { in: string[] };
    OR?: Array<Record<string, unknown>>;
    status?: LeadStatus;
    industry?: string;
    area?: { contains: string; mode: "insensitive" };
    createdBy?: { branchId: string };
  };
  const where: WhereInput = {};

  // Non-ADMIN users can only export their branch's leads
  if (user.role !== "ADMIN" && user.branchId) {
    where.createdBy = { branchId: user.branchId };
  }

  // 選択IDが指定されている場合はそのIDのみ対象
  if (idsParam) {
    where.id = { in: idsParam.split(",") };
  } else {
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }
    if (statusParam) where.status = statusParam as LeadStatus;
    if (industryParam) where.industry = industryParam;
    if (areaParam) where.area = { contains: areaParam, mode: "insensitive" };
  }

  const leads = await db.lead.findMany({
    where,
    include: {
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { scoreTotal: "desc" },
  });

  if (format === "pdf") {
    return generatePdf(leads);
  }
  if (format === "form") {
    return generateOutreachForm(leads, {
      name: session.user.name ?? "白川 裕喜",
      email: session.user.email,
    });
  }
  return generateCsv(leads);
}

// ---------------------------------------------------------------
// CSV 生成
// ---------------------------------------------------------------
type LeadRow = Awaited<ReturnType<typeof db.lead.findMany>>[number] & {
  assignee: { name: string | null; email: string } | null;
};

// ---------------------------------------------------------------
// 営業フォーム書き込み用HTML 生成
//   - フォーム送信の「コピペ用」HTMLを、リード管理のデータから自動生成する
//   - 共通項目（差出人）は編集可能。デフォルトはログインユーザー + Ad Arch株式会社
//   - 訴求を選択すると本文の中段が短い定型文に自動で差し替わる
//   - 送付済み/NG はブラウザのlocalStorageに自動保存
// ---------------------------------------------------------------
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// href に出してよいのは http(s) のみ（javascript:/data: 等のスキーム混入を防ぐ）
function safeHref(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? p.toString() : null;
  } catch {
    return null;
  }
}

function generateOutreachForm(
  leads: LeadRow[],
  sender: { name: string; email: string },
) {
  const now = new Date().toISOString().slice(0, 10);
  const senderName = escHtml(sender.name);
  const senderEmail = escHtml(sender.email);
  const subject = "広告事業のご提案（Ad Archグループ 加盟のお誘い）";

  const cards = leads
    .map((lead, idx) => {
      const no = idx + 1;
      const name = lead.name ?? "";
      const area = lead.area ?? lead.prefecture ?? "";
      const industry = lead.industry ?? "";
      const metaParts = [area, industry].filter(Boolean).join("・");
      const linkParts: string[] = [];
      const siteHref = safeHref(lead.websiteUrl);
      if (siteHref) {
        linkParts.push(
          `<a class="formbtn" href="${escHtml(siteHref)}" target="_blank" rel="noopener noreferrer">サイト↗（フォーム）</a>`,
        );
      }
      const mapsHref = safeHref(lead.mapsUrl);
      if (mapsHref) {
        linkParts.push(
          `<a href="${escHtml(mapsHref)}" target="_blank" rel="noopener noreferrer">Google Maps↗</a>`,
        );
      }
      if (lead.phone) {
        linkParts.push(`<span class="tel">☎${escHtml(lead.phone)}</span>`);
      }
      return `<div class="card" id="c${no}" data-no="${no}" data-name="${escHtml(name)}" data-area="${escHtml(area)}" data-industry="${escHtml(industry)}">
<div class="ch"><span class="no">No${no}</span> <b>${escHtml(name)}</b> <span class="meta">${escHtml(metaParts)}</span>
<span class="actions"><button class="donebtn" onclick="toggleDone('${no}')">送付済み</button><button class="ngbtn" onclick="toggleNG('${no}')">NG</button></span></div>
<div class="links">${linkParts.join(" ") || '<span class="muted">リンクなし（手動で確認）</span>'}</div>
<div class="appealrow">訴求：<select class="appeal" onchange="buildBody(document.getElementById('c${no}'))">
<option value="media">媒体提案（標準・既存事業×広告）</option>
<option value="crosssell">クライアントへのクロスセル</option>
<option value="production">制作案件の拡大（動画・映像）</option>
<option value="bigmedia">TVer等の大型媒体の取扱</option>
</select></div>
<textarea id="t${no}"></textarea>
<button class="copy" onclick="cp('t${no}',this)">本文をコピー</button>
</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>営業フォーム書き込み用（${leads.length}件）</title>
<style>
body{font-family:-apple-system,"Hiragino Sans",sans-serif;margin:0;background:#f7f8fa;color:#1a2233}
header{background:#1F3A5F;color:#fff;padding:16px 22px;position:sticky;top:0;z-index:10}header h1{margin:0;font-size:17px}header p{margin:4px 0 0;font-size:12px;opacity:.85}
.hbar{margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}.hbar span{font-size:13px;font-weight:700}
.hbtn{background:#fff;color:#1F3A5F;border:0;border-radius:6px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer}
.wrap{max-width:920px;margin:14px auto;padding:0 14px}
.common{background:#fff;border-radius:10px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.common h2{margin:0 0 8px;font-size:13px;color:#1F3A5F}.common table{width:100%;border-collapse:collapse}.common td{padding:3px 4px;vertical-align:middle}
.common td.fl{color:#475569;font-size:12px;width:84px;white-space:nowrap}.common input{width:100%;font-size:13px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff}
.btnrow a{display:inline-block;background:#10b981;color:#fff;padding:8px 12px;border-radius:7px;font-weight:700;text-decoration:none;margin:6px 8px 0 0;font-size:13px}.btnrow a.blue{background:#2563eb}
.card{background:#fff;border-radius:10px;padding:12px 14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.card.ng{opacity:.55;background:#fff1f2}.card.ng textarea{text-decoration:line-through;color:#94a3b8}
.card.done{background:#eff6ff}.card.done .ch b::after{content:" ✓送付済";color:#2563eb;font-size:12px}
.ch{font-size:14px;margin-bottom:6px;overflow:hidden}.no{background:#1F3A5F;color:#fff;border-radius:5px;padding:1px 7px;font-size:12px;margin-right:6px}
.meta{color:#64748b;font-size:12px}
.actions{float:right;white-space:nowrap}
.donebtn{background:#2563eb;color:#fff;border:0;border-radius:7px;padding:5px 11px;font-weight:700;font-size:12px;cursor:pointer;margin-left:6px}
.ngbtn{background:#ef4444;color:#fff;border:0;border-radius:7px;padding:5px 11px;font-weight:700;font-size:12px;cursor:pointer;margin-left:6px}
.card.done .donebtn{background:#16a34a}.card.ng .ngbtn{background:#64748b}
.links{margin:4px 0 8px;clear:both}
.formbtn{display:inline-block;background:#2563eb;color:#fff;padding:6px 12px;border-radius:7px;font-weight:700;text-decoration:none;font-size:13px;margin-right:8px}
.links a{color:#2563eb;text-decoration:none;font-weight:600;font-size:13px;margin-right:10px}
.tel{color:#475569;font-size:12px}.muted{color:#94a3b8;font-size:12px}
.appealrow{font-size:12px;color:#475569;margin:0 0 6px;display:flex;align-items:center;gap:6px}
.appeal{font-size:13px;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;color:#1a2233}
textarea{width:100%;height:240px;font-size:12.5px;line-height:1.55;padding:9px;border:1px solid #e2e8f0;border-radius:7px;background:#fff;box-sizing:border-box;resize:vertical}
.copy{margin-top:7px;background:#1F3A5F;color:#fff;border:0;border-radius:7px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer}
.copy.sm{padding:5px 10px;font-size:12px;margin:0}.copy.done2,.hbtn.done2{background:#10b981!important;color:#fff!important}
</style></head><body>
<header><h1>営業フォーム書き込み用（${leads.length}件）</h1><p>${now} 出力 ／ 共通項目を確認→各社の訴求を選ぶと本文が自動生成→必要なら手直し→「本文をコピー」してフォームに貼付 ／ 青=送付済み 赤=NG（自動保存）</p>
<div class="hbar"><span id="donecount">送付済 0</span><span id="ngcount">NG 0</span>
<button class="hbtn" onclick="copyList('done',this)">送付済みリストをコピー</button>
<button class="hbtn" onclick="copyList('ng',this)">NGリストをコピー</button>
<button class="hbtn" onclick="resetAll()">全解除</button></div>
</header>
<div class="wrap">
<div class="common"><h2>① 共通項目（差出人。フォームのお名前・会社名・メール・件名に貼る。直接書き換え可）</h2>
<table>
<tr><td class="fl">お名前</td><td><input id="f_name" value="${senderName}" oninput="buildAll()"></td><td><button class="copy sm" onclick="cpv('f_name',this)">コピー</button></td></tr>
<tr><td class="fl">会社名</td><td><input id="f_co" value="Ad Arch株式会社" oninput="buildAll()"></td><td><button class="copy sm" onclick="cpv('f_co',this)">コピー</button></td></tr>
<tr><td class="fl">メール</td><td><input id="f_mail" value="${senderEmail}" oninput="buildAll()"></td><td><button class="copy sm" onclick="cpv('f_mail',this)">コピー</button></td></tr>
<tr><td class="fl">件名</td><td><input id="f_subj" value="${escHtml(subject)}"></td><td><button class="copy sm" onclick="cpv('f_subj',this)">コピー</button></td></tr>
</table>
<div class="btnrow"><a class="green" href="https://www.dropbox.com/t/Hp7OcKDNSft3EigA" target="_blank">📄 説明資料</a><a class="blue" href="https://timerex.net/s/hiroki.shirakawa_717d/0c3db524" target="_blank">📅 予約ページ</a></div></div>
${cards}
</div>
<script>
const DROPBOX='https://www.dropbox.com/t/Hp7OcKDNSft3EigA';
const TIMEREX='https://timerex.net/s/hiroki.shirakawa_717d/0c3db524';
const APPEALS={
media:'{name}様はすでにお客様の制作・集客に携わっておられます。そこに「広告」という選択肢が加わると、お客様のお役に立てる場面が増えるかもしれません。広告の手配・制作・効果測定はグループでお手伝いしますので、本業はそのままに、無理のない範囲で始めていただけます（資本関係や買収ではありません）。',
crosssell:'{name}様の既存のお客様に対して、「広告」という新しいご提案ができるようになります。広告の手配・制作・効果測定はグループでお手伝いしますので、本業はそのままに、お客様一社あたりのお取引の幅を広げていただけます（資本関係や買収ではありません）。',
production:'{name}様の制作のお仕事に、動画・映像という受け皿が加わります。撮影・編集・配信先の手配はグループでお手伝いしますので、本業はそのままに、対応できる案件の幅を広げていただけます（資本関係や買収ではありません）。',
bigmedia:'TVerやイオンシネマなど、通常は個社では扱いにくい媒体を、{name}様からお客様にご提案いただけるようになります。媒体の手配・制作・効果測定はグループでお手伝いしますので、本業はそのままに始めていただけます（資本関係や買収ではありません）。'
};
function clause(area,ind){if(area&&ind)return area+'で、'+ind+'を手がけられていることを拝見し';if(ind)return ind+'を手がけられていることを拝見し';if(area)return area+'で事業をされていることを拝見し';return '貴社の事業を拝見し';}
function buildBody(card){
var name=card.dataset.name,area=card.dataset.area||'',ind=card.dataset.industry||'';
var sc=document.getElementById('f_co').value,sn=document.getElementById('f_name').value,se=document.getElementById('f_mail').value;
var ap=card.querySelector('.appeal').value;
var para=(APPEALS[ap]||APPEALS.media).replace(/\\{name\\}/g,name);
var body=[
'突然のご連絡失礼いたします。'+sc+' 代表の'+sn+'と申します。'+clause(area,ind)+'、一つご提案がありご連絡しました。','',
'ご提案を一言で申し上げると、Ad Archグループに「代表」の一人として加わっていただけないか、というお誘いです。弊社は全国で27名の代表が、フランチャイズのような形で、それぞれ独立した事業として運営するグループで、TVer・イオンシネマ・タクシー広告など、通常はなかなか取得できない広告媒体の正規代理店権をグループとして保有しています。','',
para,'',
'まずは全体像が分かる資料をご用意しています。',
'■ 説明資料：'+DROPBOX,
'■ 個別説明会のご予約：'+TIMEREX,'',
'ご関心をお持ちいただけましたら、ご返信または上記よりご連絡いただけますと幸いです。','',
sc+' 代表取締役 '+sn,
se+' / https://adarch.co.jp'
].join('\\n');
card.querySelector('textarea').value=body;
}
function buildAll(){document.querySelectorAll('.card').forEach(buildBody);}
const K={ng:'ng_os_outreach_form',done:'done_os_outreach_form'};
function get(t){return JSON.parse(localStorage.getItem(K[t])||'{}');}
function set(t,o){localStorage.setItem(K[t],JSON.stringify(o));}
function flash(btn,cls){btn.classList.add(cls);var t=btn.textContent;btn.textContent='コピーしました';setTimeout(function(){btn.classList.remove(cls);btn.textContent=t;},1200);}
function doCopy(text,btn,cls){if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(function(){flash(btn,cls||'done2');});}else{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');flash(btn,cls||'done2');}catch(e){}document.body.removeChild(ta);}}
function cp(id,btn){var el=document.getElementById(id);el.focus();el.select();doCopy(el.value,btn,'done2');}
function cpv(id,btn){var el=document.getElementById(id);doCopy(el.value,btn,'done2');}
function apply(){var ng=get('ng'),dn=get('done');document.querySelectorAll('.card').forEach(function(c){var no=c.dataset.no;c.classList.toggle('ng',!!ng[no]);c.classList.toggle('done',!!dn[no]);var nb=c.querySelector('.ngbtn');nb.textContent=ng[no]?'NG解除':'NG';var db=c.querySelector('.donebtn');db.textContent=dn[no]?'送付済み解除':'送付済み';});document.getElementById('ngcount').textContent='NG '+Object.keys(ng).length;document.getElementById('donecount').textContent='送付済 '+Object.keys(dn).length;}
function toggleNG(no){var o=get('ng');if(o[no])delete o[no];else o[no]=document.getElementById('c'+no).dataset.name;set('ng',o);apply();}
function toggleDone(no){var o=get('done');if(o[no])delete o[no];else o[no]=document.getElementById('c'+no).dataset.name;set('done',o);apply();}
function copyList(t,btn){var o=get(t);var ks=Object.keys(o).sort(function(a,b){return a-b;});var head=(t==='ng'?'【フォーム送信NG ':'【フォーム送付済み ')+ks.length+'件】';var lines=ks.map(function(k){return 'No'+k+' '+o[k];});doCopy(ks.length?(head+'\\n'+lines.join('\\n')):'(なし)',btn,'done2');}
function resetAll(){if(confirm('送付済み・NGの指定をすべて解除しますか？')){localStorage.removeItem(K.ng);localStorage.removeItem(K.done);apply();}}
window.addEventListener('load',function(){buildAll();apply();});
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="outreach_form_${now}.html"`,
    },
  });
}

function getStatusLabel(status: string): string {
  return LEAD_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function generateCsv(leads: LeadRow[]) {
  const header = [
    "企業名",
    "住所",
    "電話番号",
    "Webサイト",
    "Google評価",
    "レビュー数",
    "スコア（合計）",
    ...SCORE_ITEMS.map((s) => `スコア: ${s.label}`),
    "AIコメント",
    "業種",
    "エリア",
    "獲得元",
    "ステータス",
    "担当者",
    "メモ",
    "Google Maps",
    "登録日",
    "動画URL",
    "PR記事URL",
  ];

  const rows = leads.map((lead) => {
    const breakdown = (lead.scoreBreakdown ?? {}) as Record<string, number>;
    return [
      lead.name,
      lead.address ?? "",
      lead.phone ?? "",
      lead.websiteUrl ?? "",
      lead.rating.toString(),
      lead.ratingCount.toString(),
      lead.scoreTotal.toString(),
      ...SCORE_ITEMS.map((s) => (breakdown[s.key] ?? "").toString()),
      lead.scoreComment ?? "",
      lead.industry ?? "",
      lead.area ?? "",
      getLeadSourceOption(lead.source)?.label ?? "",
      getStatusLabel(lead.status),
      lead.assignee?.name ?? "",
      lead.memo ?? "",
      lead.mapsUrl ?? "",
      lead.createdAt.toISOString().split("T")[0],
      lead.videoUrl ?? "",
      lead.pressReleaseUrl ?? "",
    ];
  });

  const csvContent = [header, ...rows]
    .map((row) =>
      row.map((cell) => {
        const s = String(cell).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s}"`
          : s;
      }).join(",")
    )
    .join("\n");

  // BOM付きUTF-8 (Excel互換)
  const bom = "\uFEFF";
  const body = bom + csvContent;

  const now = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads_${now}.csv"`,
    },
  });
}

// ---------------------------------------------------------------
// PDF 生成（@react-pdf/renderer）
// ---------------------------------------------------------------
async function generatePdf(leads: LeadRow[]) {
  const ReactPDF = await import("@react-pdf/renderer");
  const { Document, Page, Text, View, Font, renderToBuffer } = ReactPDF;
  const React = (await import("react")).default;

  // 日本語フォント登録（Noto Sans JP）
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-400-normal.woff", fontWeight: 400 },
      { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.0.1/files/noto-sans-jp-japanese-700-normal.woff", fontWeight: 700 },
    ],
  });

  const styles = ReactPDF.StyleSheet.create({
    page: { fontFamily: "NotoSansJP", fontSize: 8, padding: 30, paddingBottom: 50 },
    title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
    subtitle: { fontSize: 8, color: "#71717a", marginBottom: 16 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f4f4f5", borderBottomWidth: 1, borderColor: "#e4e4e7", paddingVertical: 4 },
    tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#e4e4e7", paddingVertical: 3 },
    cellName: { width: "17%", paddingHorizontal: 3, fontWeight: 700 },
    cellAddress: { width: "18%", paddingHorizontal: 3 },
    cellPhone: { width: "9%", paddingHorizontal: 3 },
    cellScore: { width: "5%", paddingHorizontal: 3, textAlign: "center" },
    cellIndustry: { width: "8%", paddingHorizontal: 3 },
    cellArea: { width: "8%", paddingHorizontal: 3 },
    cellSource: { width: "8%", paddingHorizontal: 3 },
    cellStatus: { width: "7%", paddingHorizontal: 3 },
    cellComment: { width: "20%", paddingHorizontal: 3 },
    pageNumber: { position: "absolute", fontSize: 7, bottom: 20, left: 0, right: 0, textAlign: "center", color: "#a1a1aa" },
    summaryBox: { flexDirection: "row", gap: 12, marginBottom: 12 },
    summaryItem: { backgroundColor: "#f4f4f5", borderRadius: 4, padding: 8, flex: 1 },
    summaryLabel: { fontSize: 7, color: "#71717a" },
    summaryValue: { fontSize: 14, fontWeight: 700 },
  });

  // ステータスごとのカウント
  const statusCounts: Record<string, number> = {};
  for (const lead of leads) {
    statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1;
  }

  const now = new Date().toLocaleDateString("ja-JP");

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: styles.page },
      // タイトル
      React.createElement(Text, { style: styles.title }, "リード管理レポート"),
      React.createElement(Text, { style: styles.subtitle }, `出力日: ${now} / 全 ${leads.length} 件`),
      // サマリー
      React.createElement(
        View,
        { style: styles.summaryBox },
        React.createElement(
          View,
          { style: styles.summaryItem },
          React.createElement(Text, { style: styles.summaryLabel }, "総リード数"),
          React.createElement(Text, { style: styles.summaryValue }, String(leads.length))
        ),
        ...LEAD_STATUS_OPTIONS.map((opt) =>
          React.createElement(
            View,
            { key: opt.value, style: styles.summaryItem },
            React.createElement(Text, { style: styles.summaryLabel }, `${opt.icon} ${opt.label}`),
            React.createElement(Text, { style: styles.summaryValue }, String(statusCounts[opt.value] ?? 0))
          )
        )
      ),
      // テーブルヘッダー
      React.createElement(
        View,
        { style: styles.tableHeader, fixed: true },
        React.createElement(Text, { style: styles.cellName }, "企業名"),
        React.createElement(Text, { style: styles.cellAddress }, "住所"),
        React.createElement(Text, { style: styles.cellPhone }, "電話番号"),
        React.createElement(Text, { style: styles.cellScore }, "スコア"),
        React.createElement(Text, { style: styles.cellIndustry }, "業種"),
        React.createElement(Text, { style: styles.cellArea }, "エリア"),
        React.createElement(Text, { style: styles.cellSource }, "獲得元"),
        React.createElement(Text, { style: styles.cellStatus }, "ステータス"),
        React.createElement(Text, { style: styles.cellComment }, "AIコメント")
      ),
      // テーブル行
      ...leads.map((lead, i) =>
        React.createElement(
          View,
          { key: lead.id, style: { ...styles.tableRow, backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafafa" }, wrap: false },
          React.createElement(Text, { style: styles.cellName }, lead.name),
          React.createElement(Text, { style: styles.cellAddress }, lead.address ?? ""),
          React.createElement(Text, { style: styles.cellPhone }, lead.phone ?? ""),
          React.createElement(Text, { style: styles.cellScore }, String(lead.scoreTotal)),
          React.createElement(Text, { style: styles.cellIndustry }, lead.industry ?? ""),
          React.createElement(Text, { style: styles.cellArea }, lead.area ?? ""),
          React.createElement(Text, { style: styles.cellSource }, getLeadSourceOption(lead.source)?.label ?? ""),
          React.createElement(Text, { style: styles.cellStatus }, getStatusLabel(lead.status)),
          React.createElement(Text, { style: styles.cellComment }, lead.scoreComment ?? "")
        )
      ),
      // ページ番号
      React.createElement(
        Text,
        { style: styles.pageNumber, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` },
      )
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any);
  const uint8 = new Uint8Array(buffer);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="leads_${dateStr}.pdf"`,
    },
  });
}
