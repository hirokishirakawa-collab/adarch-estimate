"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Copy, Check, MapPin, Sparkles, ChevronDown, ChevronUp, Plus, Trash2, Ban, ShieldAlert, Loader2 } from "lucide-react";
import { checkNoSolicitation, getBlockedDomains, addBlockedDomain } from "@/lib/actions/no-solicitation";
import { OutreachResultBar } from "./outreach-result-bar";
import { daysSince } from "@/lib/constants/outreach-result";

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
  /** サイトから取得済みのメールアドレス。null = 未取得（リード管理の「メールを取得」で取り込める） */
  email: string | null;
  nearbyPref: string | null;
  alreadySent: boolean;
  /** 送付日（結果バーの「◯日経過」表示用）。未送付なら null */
  sentAt: string | null;
  /** 送った先から返ってきた結果。null = まだ返事待ち */
  outreachResult: string | null;
}
export interface ProvenCopy {
  industry: string;
  result: "DEAL" | "REPLIED_OK" | "REPLIED_NG";
  company: string;
  body: string;
}
interface Props {
  leads: OutreachLead[];
  provenCopies: ProvenCopy[];
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  initialSamples: MySample[];
}

// ---------------------------------------------------------------
// 営業文テンプレート（用語規制遵守・価格非開示・媒体起点）
// ---------------------------------------------------------------
// 加盟募集の文言は入れない。広告媒体営業／動画制作営業の単純なご提案文。
// グループ加盟者（各社）が自分の見込み客に送る前提。差出人は共通項目で各社が設定。
const APPEALS: { value: string; label: string; text: string }[] = [
  {
    value: "media",
    label: "広告媒体のご提案（TVer等）",
    text: "{name}様の集客のお手伝いとして、広告媒体のご提案ができればと考えております。TVer・イオンシネマ・タクシー広告など、通常は個社では取り扱いにくい媒体も、当社でまとめて手配・制作・効果測定まで対応いたします。御社の商圏やご予算に合わせてご提案しますので、小さくお試しいただくことも可能です。",
  },
  {
    value: "video",
    label: "動画・映像制作のご提案",
    text: "{name}様の商品・サービスを伝える動画・映像制作のご提案ができればと考えております。撮影・編集から、SNS・Web・店頭サイネージなど配信先に合わせた制作まで一貫して対応いたします。ご用途に合わせてご提案しますので、まずは一本からでもご相談いただけます。",
  },
  {
    value: "both",
    label: "広告媒体＋動画制作",
    text: "{name}様の集客に向けて、広告媒体の出稿と動画・映像制作の両面でお手伝いできればと考えております。媒体の手配から動画の制作・効果測定まで一貫して対応し、御社の商圏・ご予算に合わせてご提案いたします。",
  },
];
const APPEAL_MAP = Object.fromEntries(APPEALS.map((a) => [a.value, a]));

// 自作サンプル（各社が共通項目で作成・端末に保持）。訴求セレクトに value="my:<id>" で並ぶ。
interface MySample {
  id: string;
  name: string;
  text: string;
}
const MY_PREFIX = "my:";

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

// 訴求キー → 本文中段のテンプレート文を解決（自作サンプル対応）
function resolveAppealText(appeal: string, samples: MySample[]): string {
  if (appeal.startsWith(MY_PREFIX)) {
    const s = samples.find((x) => MY_PREFIX + x.id === appeal);
    if (s) return s.text;
  }
  return (APPEAL_MAP[appeal] ?? APPEALS[0]).text;
}

function buildBody(lead: OutreachLead, appeal: string, proximity: boolean, c: Common, samples: MySample[]): string {
  const para = resolveAppealText(appeal, samples).replace(/\{name\}/g, lead.name);
  const lines = [
    `突然のご連絡失礼いたします。${c.company}の${c.name}と申します。${clause(lead.area, lead.industry)}、ご提案がありご連絡しました。`,
    "",
    para,
  ];
  if (proximity && lead.nearbyPref) {
    lines.push(
      "",
      `なお、${lead.nearbyPref}にも当社の担当がおりますので、ご希望でしたら対面でのご説明も可能です。`,
    );
  }
  lines.push(
    "",
    "よろしければ、事例を含めた詳しいご案内をお送りいたします。ご興味をお持ちいただけましたら、本メールにご返信いただけますと幸いです。",
    "",
    `${c.company}　${c.name}`,
    c.email,
  );
  return lines.join("\n");
}

const SKIP_KEY = "skip_os_outreach_page"; // 送付見送り（端末ローカル）
const PROFILE_KEY = "profile_os_outreach_form"; // 共通項目（差出人）の記憶

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

export function OutreachForm({ leads, provenCopies, senderName, senderEmail, senderCompany, initialSamples }: Props) {
  const [common, setCommon] = useState<Common>({
    name: senderName,
    company: senderCompany,
    email: senderEmail,
  });
  const [subject, setSubject] = useState("広告媒体・動画制作のご案内");
  const [mySamples, setMySamples] = useState<MySample[]>(initialSamples);
  const samplesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初期カード状態
  const [cards, setCards] = useState<Record<string, CardState>>(() => {
    const init: Record<string, CardState> = {};
    for (const l of leads) {
      const appeal = "media";
      const proximity = !!l.nearbyPref; // 近接が判明していれば既定でON
      init[l.id] = {
        appeal,
        proximity,
        body: buildBody(l, appeal, proximity, { name: senderName, company: senderCompany, email: senderEmail }, []),
        sent: l.alreadySent,
        ng: false,
        busy: false,
      };
    }
    return init;
  });

  const leadById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);

  // ── 営業お断り。domain → 理由。載っている会社には送らせない
  const [blocked, setBlocked] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  const domainOf = (url: string | null) => {
    if (!url) return null;
    try {
      const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
      return h.startsWith("www.") ? h.slice(4) : h;
    } catch { return null; }
  };
  const blockReasonOf = (url: string | null) => {
    const d = domainOf(url);
    return d ? blocked[d] : undefined;
  };

  useEffect(() => {
    const urls = leads.map((l) => l.websiteUrl).filter((u): u is string => !!u);
    if (urls.length === 0) return;
    getBlockedDomains(urls).then(setBlocked).catch(() => {});
  }, [leads]);

  async function runSolicitationCheck() {
    const targets = leads
      .filter((l) => l.websiteUrl && !blockReasonOf(l.websiteUrl))
      .slice(0, 30);
    if (targets.length === 0) { setCheckMsg("確認できるWebサイトがありません"); return; }
    setChecking(true);
    setCheckMsg(`${targets.length}件を確認しています...`);
    try {
      const res = await checkNoSolicitation(targets.map((l) => ({ url: l.websiteUrl!, companyName: l.name })));
      if (res.error) { setCheckMsg(res.error); return; }
      const hits = (res.results ?? []).filter((x) => x.status === "blocked" || x.status === "already");
      const unreachable = (res.results ?? []).filter((x) => x.status === "unreachable").length;
      const next = { ...blocked };
      for (const h of hits) if (h.domain) next[h.domain] = h.phrase ?? "営業お断りの記載あり";
      setBlocked(next);
      setCheckMsg(
        hits.length > 0
          ? `営業お断り ${hits.length}件を検出しました。全社共通リストに登録済みです（他の拠点からも送れなくなります）`
            + (unreachable ? ` / サイトを開けず未確認 ${unreachable}件` : "")
          : "お断りの記載は見つかりませんでした" + (unreachable ? `（サイトを開けず未確認 ${unreachable}件）` : "")
      );
    } finally {
      setChecking(false);
    }
  }

  async function markBlocked(leadId: string) {
    const lead = leadById[leadId];
    if (!lead?.websiteUrl) { alert("Webサイトが登録されていないため、ドメインを特定できません"); return; }
    const reason = prompt(`${lead.name} を全社の営業お断りリストに登録します。\n理由（任意）:`, "サイトに営業お断りの記載");
    if (reason === null) return;
    const res = await addBlockedDomain(lead.websiteUrl, lead.name, reason);
    if (res.error) { alert(res.error); return; }
    if (res.domain) setBlocked((p) => ({ ...p, [res.domain!]: reason || "営業お断り" }));
  }

  // 共通項目（差出人）の記憶を保存
  const saveProfile = useCallback((c: Common, subj: string) => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...c, subject: subj }));
    } catch {
      /* noop */
    }
  }, []);

  // 自作サンプルの変更 → アカウントに保存（DB・デバウンスPUT）
  const onSamplesChange = useCallback((next: MySample[]) => {
    setMySamples(next);
    if (samplesSaveTimer.current) clearTimeout(samplesSaveTimer.current);
    samplesSaveTimer.current = setTimeout(() => {
      fetch("/api/leads/outreach/samples", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: next }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          // サーバー採番のIDに同期（新規作成分のID確定）
          if (data?.samples && Array.isArray(data.samples)) setMySamples(data.samples);
        })
        .catch(() => {
          /* noop（次回保存で再送される） */
        });
    }, 800);
  }, []);

  // マウント時: 送付見送り＋共通項目の記憶を読み込む
  useEffect(() => {
    // 送付見送り（端末ローカル）
    try {
      const raw = JSON.parse(localStorage.getItem(SKIP_KEY) || "{}") as Record<string, boolean>;
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
    // 共通項目（差出人）の記憶 → あれば適用して全本文を再生成
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as
        | { name?: string; company?: string; email?: string; subject?: string }
        | null;
      if (saved) {
        const merged: Common = {
          name: saved.name || senderName,
          company: saved.company || senderCompany,
          email: saved.email || senderEmail,
        };
        setCommon(merged);
        if (saved.subject) setSubject(saved.subject);
        setCards((prev) => {
          const out: Record<string, CardState> = {};
          for (const [id, c] of Object.entries(prev)) {
            const lead = leadById[id];
            out[id] = lead ? { ...c, body: buildBody(lead, c.appeal, c.proximity, merged, initialSamples) } : c;
          }
          return out;
        });
      }
    } catch {
      /* noop */
    }
  }, [leadById, senderName, senderEmail, senderCompany, initialSamples]);

  const persistNg = useCallback((map: Record<string, CardState>) => {
    const ng: Record<string, boolean> = {};
    for (const [id, c] of Object.entries(map)) if (c.ng) ng[id] = true;
    try {
      localStorage.setItem(SKIP_KEY, JSON.stringify(ng));
    } catch {
      /* noop */
    }
  }, []);

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
          [id]: { ...cur, appeal, proximity, body: buildBody(lead, appeal, proximity, c, mySamples) },
        };
      });
    },
    [leadById, mySamples],
  );

  // 共通項目の変更 → 全カードの本文を再生成（手入力は上書きされます）＋記憶
  const onCommonChange = useCallback(
    (next: Common) => {
      setCommon(next);
      saveProfile(next, subject);
      setCards((prev) => {
        const out: Record<string, CardState> = {};
        for (const [id, c] of Object.entries(prev)) {
          const lead = leadById[id];
          out[id] = lead ? { ...c, body: buildBody(lead, c.appeal, c.proximity, next, mySamples) } : c;
        }
        return out;
      });
    },
    [leadById, saveProfile, subject, mySamples],
  );

  // 件名の変更 → 記憶（件名は本文には差し込まない）
  const onSubjectChange = useCallback(
    (v: string) => {
      setSubject(v);
      saveProfile(common, v);
    },
    [saveProfile, common],
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
            <span className="text-zinc-500">見送り {ngCount}</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <LabeledInput label="お名前" value={common.name} onChange={(v) => onCommonChange({ ...common, name: v })} />
          <LabeledInput label="会社名" value={common.company} onChange={(v) => onCommonChange({ ...common, company: v })} />
          <LabeledInput label="メール" value={common.email} onChange={(v) => onCommonChange({ ...common, email: v })} />
          <LabeledInput label="件名" value={subject} onChange={onSubjectChange} />
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">※ 共通項目（差出人）はこの端末に記憶され、次回も保持されます。共通項目・訴求・近接を変えると本文が再生成されるので、手直しは最後に行ってからコピーしてください。</p>

        {/* マイサンプル（自作の営業文） */}
        <MySamplesEditor samples={mySamples} onChange={onSamplesChange} />
      </div>

      {/* 営業お断りの注意喚起（常設） */}
      <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Ban className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-800">「営業お断り」の記載がある企業には送らないでください</p>
            <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
              フォームから送る前に、相手のサイトとお問い合わせページを必ず確認してください。
              下のボタンで自動確認もできますが、<span className="font-bold">検出できない書き方もあるため最終確認はご自身で</span>お願いします。
              見つけた場合は各社の「お断り登録」を押してください。全拠点に共有され、以後どこからも送られなくなります。
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              <button
                onClick={runSolicitationCheck}
                disabled={checking}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 px-3 py-1.5 rounded-lg"
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                表示中の企業を確認（最大30件）
              </button>
              {checkMsg && <span className="text-[11px] text-red-800">{checkMsg}</span>}
            </div>
          </div>
        </div>
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
            samples={mySamples}
            onAppeal={(v) => regen(lead.id, { appeal: v }, common)}
            onProximity={(v) => regen(lead.id, { proximity: v }, common)}
            onBody={(v) => setBody(lead.id, v)}
            onToggleSent={() => toggleSent(lead.id)}
            onToggleNg={() => toggleNg(lead.id)}
            blockedReason={blockReasonOf(lead.websiteUrl)}
            onMarkBlocked={() => markBlocked(lead.id)}
            subject={subject}
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
  samples,
  onAppeal,
  onProximity,
  onBody,
  onToggleSent,
  onToggleNg,
  blockedReason,
  onMarkBlocked,
  subject,
}: {
  no: number;
  lead: OutreachLead;
  state: CardState;
  provenCopies: ProvenCopy[];
  samples: MySample[];
  onAppeal: (v: string) => void;
  onProximity: (v: boolean) => void;
  onBody: (v: string) => void;
  onToggleSent: () => void;
  onToggleNg: () => void;
  /** 営業お断りの記載がある場合の理由。あるときは送信操作を止める */
  blockedReason?: string;
  onMarkBlocked: () => void;
  /** メール件名（共通項目）。メールで送る↗の下書きに使う */
  subject: string;
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
        state.ng ? "border-zinc-300 bg-zinc-50" : state.sent ? "border-blue-300 bg-blue-50/40" : "border-zinc-200"
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
                <MapPin className="w-3 h-3" /> 近くに担当（{lead.nearbyPref}）
              </span>
            )}
            {blockedReason && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-red-700 bg-red-100 rounded px-1.5 py-0.5 ring-1 ring-inset ring-red-200">
                <Ban className="w-3 h-3" /> 営業お断り
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">{meta}</div>
          {blockedReason && (
            <p className="text-[11px] text-red-700 mt-1 leading-relaxed">{blockedReason}／この会社へは送らないでください</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleSent}
            disabled={state.busy || (!!blockedReason && !state.sent)}
            title={blockedReason ? "営業お断りの記載があるため送付できません" : undefined}
            className={`text-xs font-bold rounded-lg px-2.5 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed ${
              state.sent ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {state.busy ? "…" : state.sent ? "送付済み解除" : "送付済み"}
          </button>
          {!blockedReason && (
            <button
              onClick={onMarkBlocked}
              title="このサイトに営業お断りの記載を見つけたら押してください（全社に共有されます）"
              className="inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1.5 text-zinc-400 border border-zinc-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            >
              <Ban className="w-3.5 h-3.5" />お断り登録
            </button>
          )}
          <button
            onClick={onToggleNg}
            className={`text-xs font-bold rounded-lg px-2.5 py-1.5 ${state.ng ? "bg-zinc-600 text-white" : "bg-zinc-400 text-white hover:bg-zinc-500"}`}
          >
            {state.ng ? "見送り解除" : "送付見送り"}
          </button>
        </div>
      </div>

      {/* リンク */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
        {lead.websiteUrl && (
          <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">サイト↗（フォーム）</a>
        )}
        {lead.email && !blockedReason && (
          <a
            href={`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(state.body)}`}
            title="メールソフトで件名・本文入りの下書きが開きます（送信はご自身で）"
            className="font-bold text-blue-600 hover:underline"
          >
            メールで送る↗（{lead.email}）
          </a>
        )}
        {lead.mapsUrl && (
          <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">Google Maps↗</a>
        )}
        {lead.phone && <span className="text-zinc-500">☎{lead.phone}</span>}
        {!lead.websiteUrl && !lead.mapsUrl && !lead.phone && !lead.email && <span className="text-zinc-400">リンクなし（手動で確認）</span>}
      </div>

      {/* 結果（送付済みのときだけ出す。押すとステータス更新＋グループ事例へ自動登録） */}
      {state.sent && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <OutreachResultBar leadId={lead.id} result={lead.outreachResult} />
            {lead.sentAt && (
              <span className="text-[11px] text-zinc-500">送付から{daysSince(lead.sentAt)}日</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            返事が来たらここで1クリック。文面と業種は送付ログから自動でグループ事例に残ります
          </p>
        </div>
      )}

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
            {samples.length > 0 && (
              <optgroup label="マイサンプル">
                {samples.map((s) => (
                  <option key={s.id} value={MY_PREFIX + s.id}>{s.name || "（無題）"}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {lead.nearbyPref && (
          <label className="flex items-center gap-1.5 text-xs text-emerald-700">
            <input type="checkbox" checked={state.proximity} onChange={(e) => onProximity(e.target.checked)} />
            最寄りの担当（{lead.nearbyPref}）を本文に入れる
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
          <span className={`font-bold rounded px-1.5 py-0.5 text-white ${item.result === "DEAL" ? "bg-emerald-600" : item.result === "REPLIED_OK" ? "bg-teal-600" : "bg-amber-500"}`}>
            {item.result === "DEAL" ? "商談化" : item.result === "REPLIED_OK" ? "返信あり（前向き）" : "返信あり（不成立）"}
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

// ---------------------------------------------------------------
// マイサンプル（自作の営業文）— 共通項目内で作成・端末ローカルに保持
// ---------------------------------------------------------------
function makeSampleId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function MySamplesEditor({ samples, onChange }: { samples: MySample[]; onChange: (next: MySample[]) => void }) {
  const [open, setOpen] = useState(false);

  function add() {
    onChange([...samples, { id: makeSampleId(), name: "", text: "" }]);
    setOpen(true);
  }
  function update(id: string, patch: Partial<MySample>) {
    onChange(samples.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function remove(id: string) {
    onChange(samples.filter((s) => s.id !== id));
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-bold text-[#1F3A5F] hover:opacity-80"
      >
        マイサンプル（自分の営業文）{samples.length > 0 ? `（${samples.length}）` : ""}
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            作成したサンプルは各社カードの「訴求」セレクトに表示され、選ぶと本文の中段に入ります。本文中の <code className="bg-zinc-100 px-1 rounded">{"{name}"}</code> は相手の会社名に自動で置き換わります。この端末に保存され、次回も保持されます。
          </p>
          {samples.map((s) => (
            <div key={s.id} className="rounded-lg border border-zinc-200 p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  value={s.name}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                  placeholder="サンプル名（例: 美容室向け 広告媒体）"
                  className="flex-1 text-xs px-2 py-1.5 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button onClick={() => remove(s.id)} className="text-rose-500 hover:text-rose-700 p-1" title="削除">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={s.text}
                onChange={(e) => update(s.id, { text: e.target.value })}
                rows={4}
                placeholder="営業文の本文（中段の一段落）。{name} で相手の会社名を差し込めます。"
                className="w-full text-[12.5px] leading-relaxed p-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ))}
          <button onClick={add} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
            <Plus className="w-3.5 h-3.5" /> 新しいサンプルを追加
          </button>
        </div>
      )}
    </div>
  );
}
