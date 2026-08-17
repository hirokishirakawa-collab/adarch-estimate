"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Sparkles, Mail, Trash2, Search, ChevronDown, ChevronUp,
  ArrowUpDown, X, Users2, UserRound, ExternalLink, Info,
} from "lucide-react";
import {
  addOutreachLeads, saveOutreachDraft, updateOutreachStatus,
  deleteOutreachLead, deleteOutreachLeads, updateOutreachStatuses,
} from "@/lib/actions/outreach";
import type { OutreachStatus } from "@/generated/prisma/client";

type Row = {
  id: string; companyName: string; contactName: string | null; email: string | null; website: string | null;
  businessNote: string | null; draftSubject: string | null; draftBody: string | null;
  status: OutreachStatus; ownerName: string | null;
  sentAt: string | null; repliedAt: string | null; createdAt: string;
};

type SharedRow = {
  id: string; companyName: string; website: string | null; prefecture: string | null;
  status: OutreachStatus; ownerName: string | null; ownerEmail: string | null;
  sentAt: string | null; repliedAt: string | null; createdAt: string;
};

/** 進捗の並び順そのものが「流れ」。左から右へ進む。 */
const STATUS: { value: OutreachStatus; label: string; dot: string; chip: string }[] = [
  { value: "NEW",     label: "未着手",   dot: "bg-zinc-300",    chip: "bg-zinc-50 text-zinc-600 ring-zinc-200" },
  { value: "DRAFTED", label: "下書き済", dot: "bg-violet-400",  chip: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "SENT",    label: "送信済",   dot: "bg-sky-400",     chip: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "REPLIED", label: "返信",     dot: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "MEETING", label: "商談",     dot: "bg-amber-400",   chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "OPTOUT",  label: "配信停止", dot: "bg-red-300",     chip: "bg-red-50 text-red-700 ring-red-200" },
  { value: "DEAD",    label: "見込なし", dot: "bg-zinc-200",    chip: "bg-zinc-50 text-zinc-400 ring-zinc-200" },
];
const meta = (s: OutreachStatus) => STATUS.find((x) => x.value === s) ?? STATUS[0];

const FUNNEL: OutreachStatus[] = ["NEW", "DRAFTED", "SENT", "REPLIED", "MEETING"];

const RANGES = [
  { key: "all", label: "全期間", days: 0 },
  { key: "7",   label: "7日",    days: 7 },
  { key: "30",  label: "30日",   days: 30 },
  { key: "90",  label: "90日",   days: 90 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

type SortKey = "date" | "company" | "status";

function withinRange(iso: string | null, range: RangeKey): boolean {
  if (range === "all") return true;
  if (!iso) return false;
  const days = RANGES.find((r) => r.key === range)?.days ?? 0;
  return Date.now() - new Date(iso).getTime() <= days * 86400_000;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "—";

// ─────────────────────────────────────────────
export function OutreachBoard({
  initialRows, sharedRows, isAdmin, myEmail,
}: {
  initialRows: Row[]; sharedRows: SharedRow[]; isAdmin: boolean; myEmail: string;
}) {
  const [tab, setTab] = useState<"mine" | "shared">("mine");
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="px-6 py-8 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">アウトリーチ</h1>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
            TVer・映像制作の一般企業向け。AIが下書きを作り、
            <span className="text-zinc-700 font-medium">送信はご自身がGmailで確認してから</span>行います（自動送信はしません）。
          </p>
        </div>
        <button
          onClick={() => setShowGuide((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-2 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          使い方
          {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showGuide && <Guide />}

      {/* タブ */}
      <div className="flex items-center gap-1 border-b border-zinc-200 mb-6">
        <Tab active={tab === "mine"} onClick={() => setTab("mine")} icon={<UserRound className="w-3.5 h-3.5" />}
             label={isAdmin ? "アウトリーチ管理" : "自分のアウトリーチ"} count={initialRows.length} />
        <Tab active={tab === "shared"} onClick={() => setTab("shared")} icon={<Users2 className="w-3.5 h-3.5" />}
             label="全社の送付状況" count={sharedRows.length} />
      </div>

      {tab === "mine"
        ? <MineView rows={initialRows} isAdmin={isAdmin} />
        : <SharedView rows={sharedRows} myEmail={myEmail} />}
    </div>
  );
}

function Tab({ active, onClick, label, count, icon }: {
  active: boolean; onClick: () => void; label: string; count: number; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? "border-zinc-900 text-zinc-900 font-medium"
          : "border-transparent text-zinc-400 hover:text-zinc-700"
      }`}
    >
      {icon}
      {label}
      <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded ${active ? "bg-zinc-100 text-zinc-600" : "bg-zinc-50 text-zinc-400"}`}>
        {count}
      </span>
    </button>
  );
}

function Guide() {
  const steps = [
    { n: "1", t: "リードを追加", d: "1行1社で貼り付け。「会社名, メール, 事業メモ」。配信停止リストのメールは自動で除外されます。" },
    { n: "2", t: "AI下書き", d: "会社ごとに件名と本文を生成。何度でも作り直せます。" },
    { n: "3", t: "Gmailで送信", d: "「Gmailで開く」で宛先・件名・本文が入った状態で開きます。内容を確認し、署名を付けてご自身で送信。" },
    { n: "4", t: "進捗を更新", d: "送信したら「送信済」に。ここから先は全社に共有されます。返信・商談も同じように進めます。" },
  ];
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[11px] font-medium flex items-center justify-center">{s.n}</span>
              <span className="text-sm font-medium text-zinc-900">{s.t}</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed pl-7">{s.d}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-400 mt-4 pt-4 border-t border-zinc-200 leading-relaxed">
        このページは通常のリード管理（ダッシュボード → リード）とは別系統です。ここのリードはリード一覧には出ません。
        自動でフォーム送信する「自動営業」とも別で、こちらは<span className="text-zinc-600">メールを人が送る</span>仕組みです。
      </p>
    </div>
  );
}

// ─── ファネル ─────────────────────────────────
function Funnel({ counts }: { counts: Record<string, number> }) {
  const sent = counts.SENT ?? 0;
  const replied = counts.REPLIED ?? 0;
  const meeting = counts.MEETING ?? 0;
  const sentTotal = sent + replied + meeting; // 送信済み以降の母数
  const rate = sentTotal > 0 ? Math.round(((replied + meeting) / sentTotal) * 1000) / 10 : 0;

  return (
    <div className="flex items-stretch gap-px rounded-xl border border-zinc-200 bg-zinc-200 overflow-hidden mb-5">
      {FUNNEL.map((s) => {
        const m = meta(s);
        return (
          <div key={s} className="flex-1 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
              <p className="text-[11px] text-zinc-500">{m.label}</p>
            </div>
            <p className="text-xl font-semibold text-zinc-900 tabular-nums mt-0.5">{counts[s] ?? 0}</p>
          </div>
        );
      })}
      <div className="flex-1 bg-white px-4 py-3">
        <p className="text-[11px] text-zinc-500">返信率</p>
        <p className="text-xl font-semibold text-zinc-900 tabular-nums mt-0.5">
          {rate}<span className="text-sm font-normal text-zinc-400 ml-0.5">%</span>
        </p>
      </div>
    </div>
  );
}

// ─── ツールバー ───────────────────────────────
function Toolbar({
  q, setQ, range, setRange, statusFilter, setStatusFilter, sortKey, setSortKey, sortAsc, setSortAsc, dateLabel,
}: {
  q: string; setQ: (v: string) => void;
  range: RangeKey; setRange: (v: RangeKey) => void;
  statusFilter: OutreachStatus | "ALL"; setStatusFilter: (v: OutreachStatus | "ALL") => void;
  sortKey: SortKey; setSortKey: (v: SortKey) => void;
  sortAsc: boolean; setSortAsc: (v: boolean) => void;
  dateLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="会社名・メール・メモで検索"
          className="w-full text-sm border border-zinc-200 rounded-lg pl-9 pr-8 py-2 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <select
        value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OutreachStatus | "ALL")}
        className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
      >
        <option value="ALL">すべての進捗</option>
        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* 日付フィルタ */}
      <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white overflow-hidden" title={dateLabel}>
        {RANGES.map((r) => (
          <button
            key={r.key} onClick={() => setRange(r.key)}
            className={`text-xs px-3 py-2 transition-colors ${
              range === r.key ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="inline-flex items-center gap-1">
        <select
          value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
        >
          <option value="date">日付順</option>
          <option value="company">会社名順</option>
          <option value="status">進捗順</option>
        </select>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          title={sortAsc ? "昇順" : "降順"}
          className="text-zinc-400 hover:text-zinc-900 border border-zinc-200 rounded-lg p-2 bg-white transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── 自分のアウトリーチ ───────────────────────
function MineView({ rows, isAdmin }: { rows: Row[]; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paste, setPaste] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [q, setQ] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!withinRange(r.createdAt, range)) return false;
      if (!needle) return true;
      return [r.companyName, r.email, r.businessNote, r.contactName]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(needle));
    });
    const dir = sortAsc ? 1 : -1;
    out.sort((a, b) => {
      if (sortKey === "company") return a.companyName.localeCompare(b.companyName, "ja") * dir;
      if (sortKey === "status") {
        return (STATUS.findIndex((s) => s.value === a.status) - STATUS.findIndex((s) => s.value === b.status)) * dir;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
    return out;
  }, [rows, q, range, statusFilter, sortKey, sortAsc]);

  const allChecked = view.length > 0 && view.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(view.map((r) => r.id)));
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addLeads() {
    if (!paste.trim()) return;
    startTransition(async () => {
      const res = await addOutreachLeads(paste);
      if (res.error) { alert(res.error); return; }
      setPaste(""); setShowAdd(false); router.refresh();
    });
  }

  async function genDraft(r: Row) {
    setDraftingId(r.id);
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: r.companyName, contactName: r.contactName, businessNote: r.businessNote, website: r.website }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "下書き生成に失敗しました"); return; }
      await saveOutreachDraft(r.id, data.subject ?? "", data.body ?? "");
      setExpanded((prev) => new Set(prev).add(r.id));
      router.refresh();
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setDraftingId(null);
    }
  }

  function openGmail(r: Row) {
    const params = new URLSearchParams({ view: "cm", fs: "1" });
    if (r.email) params.set("to", r.email);
    if (r.draftSubject) params.set("su", r.draftSubject);
    if (r.draftBody) params.set("body", r.draftBody);
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const setStatus = (id: string, status: OutreachStatus) =>
    startTransition(async () => { await updateOutreachStatus(id, status); router.refresh(); });

  const del = (id: string) => {
    if (!confirm("削除しますか？")) return;
    startTransition(async () => { await deleteOutreachLead(id); router.refresh(); });
  };

  const bulkDelete = () => {
    if (!confirm(`選択した ${selected.size}件 を削除しますか？`)) return;
    startTransition(async () => {
      const res = await deleteOutreachLeads([...selected]);
      if (res.error) alert(res.error);
      setSelected(new Set()); router.refresh();
    });
  };

  const bulkStatus = (status: OutreachStatus) =>
    startTransition(async () => {
      const res = await updateOutreachStatuses([...selected], status);
      if (res.error) alert(res.error);
      setSelected(new Set()); router.refresh();
    });

  return (
    <div>
      <Funnel counts={counts} />

      {/* 追加 */}
      <div className="mb-5">
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />リードを追加
          </button>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-zinc-900">リードを追加</p>
              <button onClick={() => setShowAdd(false)} className="text-zinc-300 hover:text-zinc-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-zinc-500 mb-2">1行1社。「会社名, メール, 事業メモ」の順（カンマかタブ区切り）。</p>
            <textarea
              value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} autoFocus
              placeholder={"株式会社サンプル, info@sample.co.jp, 地元スーパー3店舗運営\n○○工務店, , 注文住宅・リフォーム"}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white font-mono placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={addLeads} disabled={isPending || !paste.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}追加
              </button>
              <span className="text-[11px] text-zinc-400">配信停止リストのメールは自動でスキップされます</span>
            </div>
          </div>
        )}
      </div>

      <Toolbar
        q={q} setQ={setQ} range={range} setRange={setRange}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sortKey={sortKey} setSortKey={setSortKey} sortAsc={sortAsc} setSortAsc={setSortAsc}
        dateLabel="追加日で絞り込み"
      />

      {/* 選択操作バー */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-lg border border-zinc-900/10 bg-zinc-900 text-white px-3 py-2 mb-3">
          <span className="text-sm font-medium tabular-nums">{selected.size}件を選択中</span>
          <div className="flex-1" />
          {(["DRAFTED", "SENT", "REPLIED", "MEETING", "DEAD"] as OutreachStatus[]).map((s) => (
            <button key={s} onClick={() => bulkStatus(s)} disabled={isPending}
              className="text-xs px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40">
              {meta(s).label}にする
            </button>
          ))}
          <button onClick={bulkDelete} disabled={isPending}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-red-500/90 hover:bg-red-500 transition-colors disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5" />削除
          </button>
          <button onClick={() => setSelected(new Set())} className="text-white/50 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 一覧 */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
          <input type="checkbox" checked={allChecked} onChange={toggleAll}
            className="w-3.5 h-3.5 rounded border-zinc-300 accent-zinc-900 cursor-pointer" />
          <span className="text-[11px] text-zinc-500">
            {view.length}件{view.length !== rows.length && <span className="text-zinc-400">（全{rows.length}件中）</span>}
          </span>
        </div>

        {view.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-zinc-400">
              {rows.length === 0 ? "まだリードがありません" : "条件に合うリードがありません"}
            </p>
            {rows.length === 0 && <p className="text-xs text-zinc-400 mt-1">「リードを追加」から始めてください。</p>}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {view.map((r) => {
              const m = meta(r.status);
              const isOpen = expanded.has(r.id);
              return (
                <div key={r.id} className={`px-4 py-3 transition-colors ${selected.has(r.id) ? "bg-zinc-50" : "hover:bg-zinc-50/50"}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                      className="w-3.5 h-3.5 mt-1 rounded border-zinc-300 accent-zinc-900 cursor-pointer shrink-0" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-900">{r.companyName}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${m.chip}`}>
                          <span className={`w-1 h-1 rounded-full ${m.dot}`} />{m.label}
                        </span>
                        {r.website && (
                          <a href={r.website} target="_blank" rel="noopener noreferrer"
                            className="text-zinc-300 hover:text-zinc-600 transition-colors"><ExternalLink className="w-3 h-3" /></a>
                        )}
                        {isAdmin && r.ownerName && <span className="text-[10px] text-zinc-400">{r.ownerName}</span>}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                        {[r.email, r.businessNote].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-[10px] text-zinc-300 mt-1 tabular-nums">
                        追加 {fmt(r.createdAt)}
                        {r.sentAt && <> · 送信 {fmt(r.sentAt)}</>}
                        {r.repliedAt && <> · 返信 {fmt(r.repliedAt)}</>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => genDraft(r)} disabled={draftingId === r.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                      >
                        {draftingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {r.draftBody ? "作り直す" : "AI下書き"}
                      </button>
                      {r.draftBody && (
                        <button onClick={() => openGmail(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors">
                          <Mail className="w-3.5 h-3.5" />Gmailで開く
                        </button>
                      )}
                      <select
                        value={r.status} onChange={(e) => setStatus(r.id, e.target.value as OutreachStatus)}
                        className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      >
                        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      {r.draftBody && (
                        <button onClick={() => toggleExpand(r.id)} className="text-zinc-300 hover:text-zinc-600 p-1">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <button onClick={() => del(r.id)} className="text-zinc-200 hover:text-red-500 p-1 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && r.draftBody && (
                    <div className="mt-3 ml-6 rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-medium text-zinc-700">件名: {r.draftSubject}</p>
                      <p className="text-xs text-zinc-600 whitespace-pre-wrap mt-2 leading-relaxed">{r.draftBody}</p>
                      <p className="text-[10px] text-zinc-400 mt-3 pt-2 border-t border-zinc-100">
                        「Gmailで開く」→ 内容を確認し署名を付けて送信 → 進捗を「送信済」に
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 全社の送付状況 ───────────────────────────
function SharedView({ rows, myEmail }: { rows: SharedRow[]; myEmail: string }) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!withinRange(r.sentAt ?? r.createdAt, range)) return false;
      if (!needle) return true;
      return [r.companyName, r.ownerName, r.prefecture]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(needle));
    });
    const dir = sortAsc ? 1 : -1;
    out.sort((a, b) => {
      if (sortKey === "company") return a.companyName.localeCompare(b.companyName, "ja") * dir;
      if (sortKey === "status") {
        return (STATUS.findIndex((s) => s.value === a.status) - STATUS.findIndex((s) => s.value === b.status)) * dir;
      }
      const at = new Date(a.sentAt ?? a.createdAt).getTime();
      const bt = new Date(b.sentAt ?? b.createdAt).getTime();
      return (at - bt) * dir;
    });
    return out;
  }, [rows, q, range, statusFilter, sortKey, sortAsc]);

  return (
    <div>
      <Funnel counts={counts} />

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-2.5 mb-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          グループ全員が送信した企業です。<span className="text-zinc-700">送る前にここで重複を確認できます。</span>
          下書きの本文と連絡先は公開されません（自分の分は「自分のアウトリーチ」で見られます）。
        </p>
      </div>

      <Toolbar
        q={q} setQ={setQ} range={range} setRange={setRange}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sortKey={sortKey} setSortKey={setSortKey} sortAsc={sortAsc} setSortAsc={setSortAsc}
        dateLabel="送信日で絞り込み"
      />

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {view.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-zinc-400">
              {rows.length === 0 ? "まだ送信された企業はありません" : "条件に合う企業がありません"}
            </p>
            {q && rows.length > 0 && (
              <p className="text-xs text-zinc-400 mt-1">この会社にはまだ誰も送っていません。</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50 text-left">
                  <th className="font-medium text-zinc-500 text-[11px] px-4 py-2.5">企業名</th>
                  <th className="font-medium text-zinc-500 text-[11px] px-4 py-2.5">担当</th>
                  <th className="font-medium text-zinc-500 text-[11px] px-4 py-2.5">進捗</th>
                  <th className="font-medium text-zinc-500 text-[11px] px-4 py-2.5">送信</th>
                  <th className="font-medium text-zinc-500 text-[11px] px-4 py-2.5">返信</th>
                </tr>
              </thead>
              <tbody>
                {view.map((r) => {
                  const m = meta(r.status);
                  const mine = !!myEmail && r.ownerEmail === myEmail;
                  return (
                    <tr key={r.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-zinc-900">{r.companyName}</span>
                          {r.website && (
                            <a href={r.website} target="_blank" rel="noopener noreferrer"
                              className="text-zinc-300 hover:text-zinc-600"><ExternalLink className="w-3 h-3" /></a>
                          )}
                        </div>
                        {r.prefecture && <p className="text-[10px] text-zinc-400 mt-0.5">{r.prefecture}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded ${mine ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                          {r.ownerName ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ring-1 ring-inset ${m.chip}`}>
                          <span className={`w-1 h-1 rounded-full ${m.dot}`} />{m.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500 tabular-nums">{fmt(r.sentAt)}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500 tabular-nums">{fmt(r.repliedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
