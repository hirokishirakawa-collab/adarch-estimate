"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Copy, Check, MapPin, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

// ---------------------------------------------------------------
// 型
// ---------------------------------------------------------------
export interface OutreachLead {
  id: string;
  name: string;
  area: string;
  industry: string;
  websiteUrl: string | null;
  mapsUrl: string | null;
  phone: string | null;
  nearbyPref: string | null;
  alreadySent: boolean;
}
export interface ProvenCopy {
  industry: string;
  result: "DEAL" | "REPLIED_NG";
  company: string;
  body: string;
}
interface Props {
  leads: OutreachLead[];
  provenCopies: ProvenCopy[];
  senderName: string;
  senderEmail: string;
}

// ---------------------------------------------------------------
// 営業文テンプレート（用語規制遵守・価格非開示・媒体起点）
// ---------------------------------------------------------------
const DROPBOX = "https://www.dropbox.com/t/Hp7OcKDNSft3EigA";
const TIMEREX = "https://timerex.net/s/hiroki.shirakawa_717d/0c3db524";

const APPEALS: { value: string; label: string; text: string }[] = [
  {
    value: "media",
    label: "媒体提案（標準・既存事業×広告）",
    text: "{name}様はすでにお客様の制作・集客に携わっておられます。そこに「広告」という選択肢が加わると、お客様のお役に立てる場面が増えるかもしれません。広告の手配・制作・効果測定はグループでお手伝いしますので、本業はそのままに、無理のない範囲で始めていただけます（資本関係や買収ではありません）。",
  },
  {
    value: "crosssell",
    label: "クライアントへのクロスセル",
    text: "{name}様の既存のお客様に対して、「広告」という新しいご提案ができるようになります。広告の手配・制作・効果測定はグループでお手伝いしますので、本業はそのままに、お客様一社あたりのお取引の幅を広げていただけます（資本関係や買収ではありません）。",
  },
  {
    value: "production",
    label: "制作案件の拡大（動画・映像）",
    text: "{name}様の制作のお仕事に、動画・映像という受け皿が加わります。撮影・編集・配信先の手配はグループでお手伝いしますので、本業はそのままに、対応できる案件の幅を広げていただけます（資本関係や買収ではありません）。",
  },
  {
    value: "bigmedia",
    label: "TVer等の大型媒体の取扱",
    text: "TVerやイオンシネマなど、通常は個社では扱いにくい媒体を、{name}様からお客様にご提案いただけるようになります。媒体の手配・制作・効果測定はグループでお手伝いしますので、本業はそのままに始めていただけます（資本関係や買収ではありません）。",
  },
];
const APPEAL_MAP = Object.fromEntries(APPEALS.map((a) => [a.value, a]));

function clause(area: string, ind: string): string {
  if (area && ind) return `${area}で、${ind}を手がけられていることを拝見し`;
  if (ind) return `${ind}を手がけられていることを拝見し`;
  if (area) return `${area}で事業をされていることを拝見し`;
  return "貴社の事業を拝見し";
}

interface Common {
  name: string;
  company: string;
  email: string;
}
function buildBody(lead: OutreachLead, appeal: string, proximity: boolean, c: Common): string {
  const para = (APPEAL_MAP[appeal] ?? APPEALS[0]).text.replace(/\{name\}/g, lead.name);
  const lines = [
    `突然のご連絡失礼いたします。${c.company} 代表の${c.name}と申します。${clause(lead.area, lead.industry)}、一つご提案がありご連絡しました。`,
    "",
    "ご提案を一言で申し上げると、Ad Archグループに「代表」の一人として加わっていただけないか、というお誘いです。弊社は全国で27名の代表が、フランチャイズのような形で、それぞれ独立した事業として運営するグループで、TVer・イオンシネマ・タクシー広告など、通常はなかなか取得できない広告媒体の正規代理店権をグループとして保有しています。",
    "",
    para,
  ];
  if (proximity && lead.nearbyPref) {
    lines.push(
      "",
      `なお、お近くの${lead.nearbyPref}にも弊社の代表がおりますので、ご希望でしたら対面でのご説明も可能です。`,
    );
  }
  lines.push(
    "",
    "まずは全体像が分かる資料をご用意しています。",
    `■ 説明資料：${DROPBOX}`,
    `■ 個別説明会のご予約：${TIMEREX}`,
    "",
    "ご関心をお持ちいただけましたら、ご返信または上記よりご連絡いただけますと幸いです。",
    "",
    `${c.company} 代表取締役 ${c.name}`,
    `${c.email} / https://adarch.co.jp`,
  );
  return lines.join("\n");
}

const NG_KEY = "ng_os_outreach_page";

// ---------------------------------------------------------------
// カードの状態
// ---------------------------------------------------------------
interface CardState {
  appeal: string;
  proximity: boolean;
  body: string;
  sent: boolean;
  ng: boolean;
  busy: boolean;
}

export function OutreachForm({ leads, provenCopies, senderName, senderEmail }: Props) {
  const [common, setCommon] = useState<Common>({
    name: senderName,
    company: "Ad Arch株式会社",
    email: senderEmail,
  });
  const [subject, setSubject] = useState("広告事業のご提案（Ad Archグループ 加盟のお誘い）");

  // 初期カード状態
  const [cards, setCards] = useState<Record<string, CardState>>(() => {
    const init: Record<string, CardState> = {};
    for (const l of leads) {
      const appeal = "media";
      const proximity = !!l.nearbyPref; // 近接が判明していれば既定でON
      init[l.id] = {
        appeal,
        proximity,
        body: buildBody(l, appeal, proximity, { name: senderName, company: "Ad Arch株式会社", email: senderEmail }),
        sent: l.alreadySent,
        ng: false,
        busy: false,
      };
    }
    return init;
  });

  // NG は端末ローカルに保存（OS項目を持たないため）
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(NG_KEY) || "{}") as Record<string, boolean>;
      setCards((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (raw[id]) next[id] = { ...next[id], ng: true };
        }
        return next;
      });
    } catch {
      /* noop */
    }
  }, []);

  const persistNg = useCallback((map: Record<string, CardState>) => {
    const ng: Record<string, boolean> = {};
    for (const [id, c] of Object.entries(map)) if (c.ng) ng[id] = true;
    try {
      localStorage.setItem(NG_KEY, JSON.stringify(ng));
    } catch {
      /* noop */
    }
  }, []);

  const leadById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);

  // 訴求・近接の変更 → そのカードの本文を再生成
  const regen = useCallback(
    (id: string, patch: Partial<Pick<CardState, "appeal" | "proximity">>, c: Common) => {
      setCards((prev) => {
        const cur = prev[id];
        const lead = leadById[id];
        if (!cur || !lead) return prev;
        const appeal = patch.appeal ?? cur.appeal;
        const proximity = patch.proximity ?? cur.proximity;
        return {
          ...prev,
          [id]: { ...cur, appeal, proximity, body: buildBody(lead, appeal, proximity, c) },
        };
      });
    },
    [leadById],
  );

  // 共通項目の変更 → 全カードの本文を再生成（手入力は上書きされます）
  const onCommonChange = useCallback(
    (next: Common) => {
      setCommon(next);
      setCards((prev) => {
        const out: Record<string, CardState> = {};
        for (const [id, c] of Object.entries(prev)) {
          const lead = leadById[id];
          out[id] = lead ? { ...c, body: buildBody(lead, c.appeal, c.proximity, next) } : c;
        }
        return out;
      });
    },
    [leadById],
  );

  // 送付済みトグル → OSへ反映
  async function toggleSent(id: string) {
    const cur = cards[id];
    if (!cur || cur.busy) return;
    const mark = !cur.sent;
    setCards((p) => ({ ...p, [id]: { ...p[id], busy: true } }));
    try {
      const res = await fetch("/api/leads/outreach/sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: id,
          appeal: APPEAL_MAP[cur.appeal]?.label ?? cur.appeal,
          body: cur.body,
          action: mark ? "mark" : "unmark",
        }),
      });
      if (!res.ok) throw new Error("failed");
      setCards((p) => ({ ...p, [id]: { ...p[id], sent: mark, busy: false } }));
    } catch {
      setCards((p) => ({ ...p, [id]: { ...p[id], busy: false } }));
      alert("OSへの反映に失敗しました。通信状況をご確認ください。");
    }
  }

  function toggleNg(id: string) {
    setCards((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ng: !prev[id].ng } };
      persistNg(next);
      return next;
    });
  }

  function setBody(id: string, body: string) {
    setCards((p) => ({ ...p, [id]: { ...p[id], body } }));
  }

  const sentCount = Object.values(cards).filter((c) => c.sent).length;
  const ngCount = Object.values(cards).filter((c) => c.ng).length;

  return (
    <div className="space-y-4">
      {/* ===== 共通項目 ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm font-bold text-[#1F3A5F]">① 共通項目（差出人。フォームに貼る項目。直接編集可）</h3>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-blue-700">送付済 {sentCount}</span>
            <span className="text-rose-600">NG {ngCount}</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <LabeledInput label="お名前" value={common.name} onChange={(v) => onCommonChange({ ...common, name: v })} />
          <LabeledInput label="会社名" value={common.company} onChange={(v) => onCommonChange({ ...common, company: v })} />
          <LabeledInput label="メール" value={common.email} onChange={(v) => onCommonChange({ ...common, email: v })} />
          <LabeledInput label="件名" value={subject} onChange={setSubject} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <a href={DROPBOX} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-500 rounded-lg hover:bg-emerald-600">📄 説明資料</a>
          <a href={TIMEREX} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700">📅 予約ページ</a>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">※ 共通項目・訴求・近接を変えると本文が再生成されます。手直しは最後に行ってからコピーしてください。</p>
      </div>

      {leads.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-sm text-zinc-500">
          対象のリードがありません。リード管理で絞り込んでから再度開いてください。
        </div>
      )}

      {/* ===== カード ===== */}
      {leads.map((lead, i) => {
        const c = cards[lead.id];
        if (!c) return null;
        return (
          <OutreachCard
            key={lead.id}
            no={i + 1}
            lead={lead}
            state={c}
            provenCopies={provenCopies}
            onAppeal={(v) => regen(lead.id, { appeal: v }, common)}
            onProximity={(v) => regen(lead.id, { proximity: v }, common)}
            onBody={(v) => setBody(lead.id, v)}
            onToggleSent={() => toggleSent(lead.id)}
            onToggleNg={() => toggleNg(lead.id)}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------
// 入力欄
// ---------------------------------------------------------------
function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 w-14 shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-sm px-2.5 py-1.5 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
}

// ---------------------------------------------------------------
// 1リードのカード
// ---------------------------------------------------------------
function OutreachCard({
  no,
  lead,
  state,
  provenCopies,
  onAppeal,
  onProximity,
  onBody,
  onToggleSent,
  onToggleNg,
}: {
  no: number;
  lead: OutreachLead;
  state: CardState;
  provenCopies: ProvenCopy[];
  onAppeal: (v: string) => void;
  onProximity: (v: boolean) => void;
  onBody: (v: string) => void;
  onToggleSent: () => void;
  onToggleNg: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showProven, setShowProven] = useState(false);
  const [showAllProven, setShowAllProven] = useState(false);

  const matched = useMemo(() => {
    if (!lead.industry) return [];
    return provenCopies.filter(
      (p) => p.industry && (p.industry === lead.industry || p.industry.includes(lead.industry) || lead.industry.includes(p.industry)),
    );
  }, [provenCopies, lead.industry]);
  const shown = showAllProven ? provenCopies : matched;

  async function copy() {
    try {
      await navigator.clipboard.writeText(state.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  }

  const meta = [lead.area, lead.industry].filter(Boolean).join("・");

  return (
    <div
      className={`bg-white rounded-xl border p-4 transition-colors ${
        state.ng ? "border-rose-200 bg-rose-50/40" : state.sent ? "border-blue-300 bg-blue-50/40" : "border-zinc-200"
      }`}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-white bg-[#1F3A5F] rounded px-1.5 py-0.5">No{no}</span>
            <span className={`font-bold text-zinc-900 ${state.ng ? "line-through text-zinc-400" : ""}`}>{lead.name}</span>
            {state.sent && <span className="text-[11px] font-bold text-blue-600">✓ 送付済（OS反映済）</span>}
            {lead.nearbyPref && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">
                <MapPin className="w-3 h-3" /> 近くに代表（{lead.nearbyPref}）
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">{meta}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleSent}
            disabled={state.busy}
            className={`text-xs font-bold rounded-lg px-2.5 py-1.5 disabled:opacity-50 ${
              state.sent ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {state.busy ? "…" : state.sent ? "送付済み解除" : "送付済み"}
          </button>
          <button
            onClick={onToggleNg}
            className={`text-xs font-bold rounded-lg px-2.5 py-1.5 ${state.ng ? "bg-zinc-500 text-white" : "bg-rose-500 text-white hover:bg-rose-600"}`}
          >
            {state.ng ? "NG解除" : "NG"}
          </button>
        </div>
      </div>

      {/* リンク */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
        {lead.websiteUrl && (
          <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">サイト↗（フォーム）</a>
        )}
        {lead.mapsUrl && (
          <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">Google Maps↗</a>
        )}
        {lead.phone && <span className="text-zinc-500">☎{lead.phone}</span>}
        {!lead.websiteUrl && !lead.mapsUrl && !lead.phone && <span className="text-zinc-400">リンクなし（手動で確認）</span>}
      </div>

      {/* 操作行 */}
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          訴求：
          <select
            value={state.appeal}
            onChange={(e) => onAppeal(e.target.value)}
            className="text-xs px-2 py-1.5 border border-zinc-200 rounded-lg bg-white"
          >
            {APPEALS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </label>
        {lead.nearbyPref && (
          <label className="flex items-center gap-1.5 text-xs text-emerald-700">
            <input type="checkbox" checked={state.proximity} onChange={(e) => onProximity(e.target.checked)} />
            最寄り代表（{lead.nearbyPref}）を本文に入れる
          </label>
        )}
        <button
          onClick={() => setShowProven((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          反応の良かった文面 {matched.length > 0 ? `(${matched.length})` : ""}
          {showProven ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 反応の良かった文面（参照・読み取り専用） */}
      {showProven && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          {shown.length === 0 && (
            <p className="text-xs text-zinc-500">
              この業種の実績文面はまだOSにありません。
              {!showAllProven && provenCopies.length > 0 && (
                <button onClick={() => setShowAllProven(true)} className="ml-1 text-blue-600 underline">全業種から探す</button>
              )}
            </p>
          )}
          {shown.slice(0, 5).map((p, idx) => (
            <ProvenItem key={idx} item={p} onAdopt={() => onBody(p.body)} />
          ))}
          {matched.length > 0 && !showAllProven && provenCopies.length > matched.length && (
            <button onClick={() => setShowAllProven(true)} className="text-xs text-blue-600 underline">全業種からも探す</button>
          )}
        </div>
      )}

      {/* 本文 */}
      <textarea
        value={state.body}
        onChange={(e) => onBody(e.target.value)}
        rows={12}
        className={`w-full mt-3 text-[13px] leading-relaxed p-3 border border-zinc-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 ${state.ng ? "line-through text-zinc-400" : ""}`}
      />
      <button
        onClick={copy}
        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F3A5F] rounded-lg hover:bg-[#16304f]"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "コピーしました" : "本文をコピー"}
      </button>
    </div>
  );
}

function ProvenItem({ item, onAdopt }: { item: ProvenCopy; onAdopt: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md bg-white border border-amber-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`font-bold rounded px-1.5 py-0.5 text-white ${item.result === "DEAL" ? "bg-emerald-600" : "bg-amber-500"}`}>
            {item.result === "DEAL" ? "商談化" : "返信あり"}
          </span>
          <span className="text-zinc-500">{item.industry}{item.company ? `／${item.company}` : ""}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setOpen((o) => !o)} className="text-[11px] text-zinc-500 hover:text-zinc-800">{open ? "閉じる" : "全文"}</button>
          <button onClick={onAdopt} className="text-[11px] font-bold text-blue-600 hover:underline">この文面を採用</button>
        </div>
      </div>
      <p className={`text-[12px] text-zinc-700 mt-1 whitespace-pre-wrap ${open ? "" : "line-clamp-2"}`}>{item.body}</p>
    </div>
  );
}
