"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Sparkles, Mail, Trash2, Search, ChevronDown, ChevronUp,
  ArrowUpDown, X, Users2, UserRound, ExternalLink, Info, Upload, Ban, ShieldAlert, FileText, Save,
} from "lucide-react";
import {
  addOutreachLeads, saveOutreachDraft, updateOutreachStatus,
  deleteOutreachLead, deleteOutreachLeads, updateOutreachStatuses,
} from "@/lib/actions/outreach";
import {
  parseOutreachImportFile, addOutreachLeadsFromRows, updateOutreachLeadEmail,
  type ImportRow,
} from "@/lib/actions/outreach-import";
import {
  checkNoSolicitation, getBlockedDomains, addBlockedDomain, findEmailForLead,
} from "@/lib/actions/no-solicitation";
import {
  getMyTemplate, saveMyTemplate, applyMyTemplate,
} from "@/lib/actions/outreach-template";
import type { OutreachStatus } from "@/generated/prisma/client";

/** 訴求の方向性。api/outreach/draft の DIRECTIONS と対応させる。 */
const DIRECTIONS = [
  { key: "AD_MEDIA", label: "TVer・広告媒体" },
  { key: "VIDEO_PRODUCTION", label: "動画・映像制作" },
  { key: "SNS_MANAGEMENT", label: "SNS運用" },
  { key: "AD_AND_VIDEO", label: "広告媒体＋動画" },
  { key: "FIRST_MEETING", label: "情報交換・ご挨拶" },
] as const;
type DirectionKey = (typeof DIRECTIONS)[number]["key"];

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
    { n: "1", t: "リードを追加", d: "リード獲得AIで書き出したCSV・Excelをそのまま取り込めます。貼り付けでも追加できます。配信停止のメールと重複は自動で除外。" },
    { n: "2", t: "営業お断りを確認", d: "赤いバーの確認ボタンで、相手のサイトとお問い合わせページに断りの記載がないか調べます。見つけたら全拠点に共有され、以後どこからも送れなくなります。" },
    { n: "3", t: "文面を用意する", d: "方向性（TVer・広告媒体／動画制作／SNS運用など）を選んでAI下書き。そのまま使わず手直しできます。自分の定型文を保存して、まとめて反映することもできます。" },
    { n: "4", t: "Gmailで開いて送る", d: "宛先・件名・本文が入った状態で開きます。押した時点で「送信済」になり全社に共有されます。結局送らなかった場合は進捗を「下書き済」に戻してください。" },
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
        <span className="text-zinc-600">メールを人が送る</span>ための画面で、フォームから送る場合は「営業フォーム」を使ってください。
        どちらで送っても、送信済みは「送付済み企業（全社）」に集約されます。
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

// ─── リード獲得AIの書き出しを取り込む ─────────
function ImportPanel({ onDone }: { onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [alreadySent, setAlreadySent] = useState<Record<string, { companyName: string; branchName: string; sentAt: string }>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [dropped, setDropped] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function pick(file: File | null) {
    if (!file) return;
    setErr(""); setMsg(""); setRows(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await parseOutreachImportFile(fd);
      if (res.error) { setErr(res.error); return; }
      setRows(res.rows ?? []);
      setAlreadySent(res.alreadySent ?? {});
      setHeaders(res.headers ?? []);
      setDropped(res.dropped ?? 0);
    });
  }

  function commit() {
    if (!rows?.length) return;
    startTransition(async () => {
      const res = await addOutreachLeadsFromRows(rows);
      if (res.error) { setErr(res.error); return; }
      const parts = [`${res.added ?? 0}件を取り込みました`];
      if (res.skippedDup) parts.push(`重複${res.skippedDup}件`);
      if (res.skippedOptOut) parts.push(`配信停止${res.skippedOptOut}件`);
      setMsg(parts.join(" / "));
      setRows(null);
      onDone();
    });
  }

  const withEmail = rows?.filter((r) => r.email).length ?? 0;
  const withoutEmail = (rows?.length ?? 0) - withEmail;

  const domainOfRow = (u: string | null) => {
    if (!u) return null;
    try {
      const h = new URL(u.startsWith("http") ? u : `https://${u}`).hostname.toLowerCase();
      return h.startsWith("www.") ? h.slice(4) : h;
    } catch { return null; }
  };
  const dupCount = (rows ?? []).filter((r) => {
    const d = domainOfRow(r.website);
    return d ? !!alreadySent[d] : false;
  }).length;

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
        リード獲得AI（ダッシュボード → リード獲得AI）で書き出したファイルをそのまま選べます。
        CSV・Excel（.xlsx）のどちらでも読めます。列は見出し名で判別するので、列の順番が違っても大丈夫です。
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0] ?? null); }}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors ${
          dragging ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50/50"
        }`}
      >
        <Upload className="w-6 h-6 text-zinc-400" />
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-zinc-900 px-4 py-2 rounded-lg">
          ファイルを選ぶ
        </span>
        <span className="text-xs text-zinc-500">ここにドラッグ＆ドロップでも取り込めます</span>
        <span className="text-[11px] text-zinc-400">.csv / .xlsx（10MBまで・2000行まで）</span>
        <input
          type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden" disabled={isPending}
          onChange={(e) => { pick(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
        />
      </label>

      {isPending && !rows && (
        <p className="text-xs text-zinc-500 mt-3 inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />読み取り中...
        </p>
      )}
      {err && <p className="text-xs text-red-600 mt-3 leading-relaxed">{err}</p>}
      {msg && <p className="text-xs text-emerald-700 mt-3">{msg}</p>}

      {rows && (
        <div className="mt-4">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="text-sm font-medium text-zinc-900 tabular-nums">{rows.length}件 読み取りました</span>
            {dropped > 0 && <span className="text-[11px] text-zinc-400">会社名なしで除外 {dropped}件</span>}
          </div>

          {dupCount > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 mb-3">
              <p className="text-xs text-orange-900 leading-relaxed">
                <span className="font-medium">{dupCount}件は既にグループの誰かが送っています。</span>
                {" "}取り込み自体は止めませんが、二重に当たらないよう送る前に「送付済み企業（全社）」で確認してください。
              </p>
            </div>
          )}

          {withoutEmail > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mb-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-medium">{withoutEmail}件はメールアドレスがありません。</span>
                {" "}リード獲得AIの書き出しにメール列がないためです（Google Places由来のデータに含まれないため）。
                取り込んだあと一覧からメールを直接入力できます。Webサイトは入るので、そこから調べる形になります。
              </p>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 overflow-hidden mb-3">
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium text-zinc-500">企業名</th>
                    <th className="px-3 py-2 font-medium text-zinc-500">メール</th>
                    <th className="px-3 py-2 font-medium text-zinc-500">Web</th>
                    <th className="px-3 py-2 font-medium text-zinc-500">エリア</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-zinc-50 last:border-0">
                      <td className="px-3 py-1.5 text-zinc-800">
                        {r.companyName}
                        {(() => { const d = domainOfRow(r.website); const s = d ? alreadySent[d] : null;
                          return s ? <span className="ml-1.5 text-[10px] text-orange-700 bg-orange-100 rounded px-1.5 py-0.5">{s.branchName}が送信済</span> : null; })()}
                      </td>
                      <td className="px-3 py-1.5 text-zinc-500">{r.email ?? <span className="text-amber-500">—</span>}</td>
                      <td className="px-3 py-1.5 text-zinc-400 truncate max-w-[180px]">{r.website ?? "—"}</td>
                      <td className="px-3 py-1.5 text-zinc-500">{r.prefecture ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && (
              <p className="text-[11px] text-zinc-400 px-3 py-2 border-t border-zinc-100">
                先頭50件を表示（取り込みは{rows.length}件すべて）
              </p>
            )}
          </div>

          {headers.length > 0 && (
            <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
              読み取れた見出し: {headers.slice(0, 14).join(" / ")}{headers.length > 14 ? " ..." : ""}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={commit} disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {rows.length}件を取り込む
            </button>
            <button onClick={() => setRows(null)} className="text-xs text-zinc-500 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors">
              やめる
            </button>
            <span className="text-[11px] text-zinc-400">同じ会社名が既にある行と、配信停止のメールは自動で除きます</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 自分のアウトリーチ ───────────────────────
function MineView({ rows, isAdmin }: { rows: Row[]; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paste, setPaste] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"file" | "paste">("file");
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 訴求の方向性。AI下書きに渡す。全体の既定を持ち、行ごとに上書きできる。
  const [direction, setDirection] = useState<DirectionKey>("AD_MEDIA");
  const [rowDirection, setRowDirection] = useState<Record<string, DirectionKey>>({});

  // 取り込み後にメールを補うための編集状態
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");

  // メール自動取得
  const [findingId, setFindingId] = useState<string | null>(null);

  // 下書きの手直し（会社ごと）
  const [editBody, setEditBody] = useState<Record<string, { subject: string; body: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // 自分の定型文
  const [showTpl, setShowTpl] = useState(false);
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplMsg, setTplMsg] = useState("");

  useEffect(() => {
    getMyTemplate().then((t) => {
      if (t) { setTplSubject(t.subject); setTplBody(t.body); }
    }).catch(() => {});
  }, []);

  // 営業お断り。domain → 理由。ここに載っている会社には送らせない
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
  const blockReason = (r: Row) => {
    const d = domainOf(r.website);
    return d ? blocked[d] : undefined;
  };

  // 画面を開いた時点で、登録済みのお断りドメインを引いておく
  useEffect(() => {
    const urls = rows.map((r) => r.website).filter((u): u is string => !!u);
    if (urls.length === 0) return;
    getBlockedDomains(urls).then(setBlocked).catch(() => {});
  }, [rows]);

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
        body: JSON.stringify({
          companyName: r.companyName, contactName: r.contactName,
          businessNote: r.businessNote, website: r.website,
          direction: rowDirection[r.id] ?? direction,
        }),
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
    const edited = editBody[r.id];
    const subject = edited?.subject ?? r.draftSubject ?? "";
    const body = edited?.body ?? r.draftBody ?? "";

    const params = new URLSearchParams({ view: "cm", fs: "1" });
    if (r.email) params.set("to", r.email);
    if (subject) params.set("su", subject);
    if (body) params.set("body", body);
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");

    // Gmailを開いた時点で送付済みとして扱う（代表判断）。
    // 全社台帳にも載るので、他の拠点が同じ会社に当たらなくなる。
    // 結局送らなかった場合は、進捗を「下書き済」に戻せば台帳からも外れる。
    if (r.status === "NEW" || r.status === "DRAFTED") {
      startTransition(async () => {
        await updateOutreachStatus(r.id, "SENT");
        router.refresh();
      });
    }
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

  /** サイトに書かれているメールを探して、見つかれば入力欄に入れる */
  async function findEmail(r: Row) {
    if (!r.website) { alert("Webサイトが登録されていないため探せません"); return; }
    setFindingId(r.id);
    try {
      const res = await findEmailForLead(r.website);
      if (res.error) { alert(res.error); return; }
      const list = res.emails ?? [];
      if (list.length === 0) {
        alert(`${r.companyName}\n\nサイトにメールアドレスの記載が見つかりませんでした。\nフォームからの送付をご検討ください。`);
        return;
      }
      const chosen = list.length === 1
        ? list[0]
        : prompt(`${r.companyName}（${res.where}に記載）\n\n使うアドレスを選んでください:\n${list.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\n番号かアドレスを入力:`, "1");
      if (!chosen) return;
      const idx = Number(chosen);
      const email = Number.isInteger(idx) && idx >= 1 && idx <= list.length ? list[idx - 1] : chosen.trim();
      const save = await updateOutreachLeadEmail(r.id, email);
      if (save.error) { alert(save.error); return; }
      router.refresh();
    } finally {
      setFindingId(null);
    }
  }

  const saveTpl = () =>
    startTransition(async () => {
      const res = await saveMyTemplate(tplSubject, tplBody);
      setTplMsg(res.error ?? "保存しました");
    });

  const applyTpl = (overwrite: boolean) => {
    const ids = selected.size > 0 ? [...selected] : view.map((r) => r.id);
    if (overwrite && !confirm(`${ids.length}件の下書きを、自分の定型文で上書きします。よろしいですか。`)) return;
    startTransition(async () => {
      const res = await applyMyTemplate(ids, { overwrite });
      if (res.error) { setTplMsg(res.error); return; }
      setTplMsg(`${res.applied ?? 0}件に反映しました` + (res.skipped ? `（対象外 ${res.skipped}件）` : ""));
      router.refresh();
    });
  };

  const saveDraft = (r: Row) => {
    const e = editBody[r.id];
    if (!e) return;
    setSavingId(r.id);
    startTransition(async () => {
      const res = await saveOutreachDraft(r.id, e.subject, e.body);
      if (res.error) alert(res.error);
      setSavingId(null);
      setEditBody((p) => { const n = { ...p }; delete n[r.id]; return n; });
      router.refresh();
    });
  };

  const saveEmail = (id: string) =>
    startTransition(async () => {
      const res = await updateOutreachLeadEmail(id, emailDraft);
      if (res.error) { alert(res.error); return; }
      setEditingEmail(null); router.refresh();
    });

  /** 選択した会社のサイトを見に行き、営業お断りの記載を探す */
  async function runSolicitationCheck() {
    const targets = view
      .filter((r) => selected.size === 0 || selected.has(r.id))
      .filter((r) => r.website && !blockReason(r))
      .slice(0, 30);
    if (targets.length === 0) { setCheckMsg("確認できるWebサイトがありません"); return; }

    setChecking(true);
    setCheckMsg(`${targets.length}件を確認しています...`);
    try {
      const res = await checkNoSolicitation(
        targets.map((r) => ({ url: r.website!, companyName: r.companyName }))
      );
      if (res.error) { setCheckMsg(res.error); return; }
      const hits = (res.results ?? []).filter((x) => x.status === "blocked" || x.status === "already");
      const unreachable = (res.results ?? []).filter((x) => x.status === "unreachable").length;

      const next = { ...blocked };
      for (const h of hits) if (h.domain) next[h.domain] = h.phrase ?? "営業お断りの記載あり";
      setBlocked(next);

      setCheckMsg(
        hits.length > 0
          ? `営業お断り ${hits.length}件を検出しました。全社共通リストに登録済みです（他の拠点からも送れなくなります）` +
            (unreachable ? ` / サイトを開けず未確認 ${unreachable}件` : "")
          : `お断りの記載は見つかりませんでした` + (unreachable ? `（サイトを開けず未確認 ${unreachable}件）` : "")
      );
    } finally {
      setChecking(false);
    }
  }

  /** 目視で見つけたときに手で登録する */
  const markBlocked = (r: Row) => {
    if (!r.website) { alert("Webサイトが登録されていないため、ドメインを特定できません"); return; }
    const reason = prompt(`${r.companyName} を全社の営業お断りリストに登録します。\n理由（任意）:`, "サイトに営業お断りの記載");
    if (reason === null) return;
    startTransition(async () => {
      const res = await addBlockedDomain(r.website!, r.companyName, reason);
      if (res.error) { alert(res.error); return; }
      if (res.domain) setBlocked((p) => ({ ...p, [res.domain!]: reason || "営業お断り" }));
      await updateOutreachStatus(r.id, "DEAD");
      router.refresh();
    });
  };

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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                {(["file", "paste"] as const).map((m) => (
                  <button
                    key={m} onClick={() => setAddMode(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      addMode === m ? "bg-zinc-900 text-white font-medium" : "text-zinc-500 hover:bg-zinc-100"
                    }`}
                  >
                    {m === "file" ? "ファイル" : "貼り付け"}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAdd(false)} className="text-zinc-300 hover:text-zinc-600"><X className="w-4 h-4" /></button>
            </div>

            {addMode === "file" ? (
              <ImportPanel onDone={() => { setShowAdd(false); router.refresh(); }} />
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* 営業お断りの注意喚起（常設） */}
      <div className="rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 mb-4">
        <div className="flex items-start gap-2.5">
          <Ban className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-red-800">「営業お断り」の記載がある企業には送らないでください</p>
            <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
              フォーム・メールのどちらも同じです。送る前に相手のサイトとお問い合わせページを必ず確認してください。
              下のボタンで自動確認もできますが、<span className="font-medium">検出できない書き方もあるため最終確認はご自身で</span>お願いします。
              見つけた場合は行の「お断り登録」を押してください。全拠点に共有され、以後どこからも送られなくなります。
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              <button
                onClick={runSolicitationCheck} disabled={checking}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
              >
                {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                {selected.size > 0 ? `選択した${selected.size}件を確認` : "表示中の企業を確認（最大30件）"}
              </button>
              {checkMsg && <span className="text-[11px] text-red-800">{checkMsg}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 訴求の方向性 */}
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-zinc-700 shrink-0">AI下書きの方向性</span>
          <div className="inline-flex items-center rounded-lg border border-zinc-200 overflow-hidden">
            {DIRECTIONS.map((d) => (
              <button
                key={d.key} onClick={() => setDirection(d.key)}
                className={`text-xs px-3 py-1.5 transition-colors ${
                  direction === d.key ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
          ここで選んだ方向で本文が書かれます。会社ごとに変えたいときは、各行の「AI下書き」の左のセレクトで上書きできます。
        </p>

        <div className="border-t border-zinc-100 mt-3 pt-3">
          <button
            onClick={() => setShowTpl((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            自分の定型文
            {showTpl ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTpl && (
            <div className="mt-3">
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-2">
                自分の言い回しを1つ保存しておき、まとめて反映できます。AIに頼らず自分の文章で送りたいときに使ってください。
                <br />
                <code className="px-1 py-0.5 bg-zinc-100 rounded text-zinc-600">{"{会社名}"}</code>
                <code className="ml-1 px-1 py-0.5 bg-zinc-100 rounded text-zinc-600">{"{担当者}"}</code>
                が送信先ごとに置き換わります。
              </p>
              <input
                value={tplSubject}
                onChange={(e) => setTplSubject(e.target.value)}
                placeholder="件名"
                className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <textarea
                rows={8}
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                placeholder={"{会社名} ご担当者さま\n\nはじめまして。..."}
                className="w-full text-xs leading-relaxed border border-zinc-200 rounded-lg px-2.5 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <button
                  onClick={saveTpl} disabled={isPending || !tplBody.trim()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Save className="w-3 h-3" />保存
                </button>
                <button
                  onClick={() => applyTpl(false)} disabled={isPending || !tplBody.trim()}
                  className="text-[11px] font-medium text-zinc-700 border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {selected.size > 0 ? `選択した${selected.size}件に反映` : "下書きが無い会社に反映"}
                </button>
                <button
                  onClick={() => applyTpl(true)} disabled={isPending || !tplBody.trim()}
                  className="text-[11px] text-zinc-500 border border-zinc-200 hover:bg-zinc-50 disabled:opacity-30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  既存の下書きも上書きして反映
                </button>
                {tplMsg && <span className="text-[11px] text-zinc-600">{tplMsg}</span>}
              </div>
              <p className="text-[10px] text-zinc-400 mt-2">
                送信済み以降の会社には反映しません（既に出した文面は書き換えても意味がないため）。
              </p>
            </div>
          )}
        </div>
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
              const banned = blockReason(r);
              return (
                <div key={r.id} className={`px-4 py-3 transition-colors ${
                  banned ? "bg-red-50/60" : selected.has(r.id) ? "bg-zinc-50" : "hover:bg-zinc-50/50"
                }`}>
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
                        {banned && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 font-medium">
                            <Ban className="w-2.5 h-2.5" />営業お断り
                          </span>
                        )}
                      </div>
                      {banned && (
                        <p className="text-[11px] text-red-700 mt-1 leading-relaxed">{banned}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {editingEmail === r.id ? (
                          <>
                            <input
                              value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} autoFocus
                              placeholder="info@example.co.jp"
                              onKeyDown={(e) => { if (e.key === "Enter") saveEmail(r.id); if (e.key === "Escape") setEditingEmail(null); }}
                              className="text-[11px] border border-zinc-300 rounded px-2 py-1 w-56 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                            />
                            <button onClick={() => saveEmail(r.id)} className="text-[11px] text-white bg-zinc-900 px-2 py-1 rounded">保存</button>
                            <button onClick={() => setEditingEmail(null)} className="text-[11px] text-zinc-400 px-1">取消</button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingEmail(r.id); setEmailDraft(r.email ?? ""); }}
                            className={`text-[11px] rounded px-1.5 py-0.5 transition-colors ${
                              r.email ? "text-zinc-500 hover:bg-zinc-100" : "text-amber-700 bg-amber-50 hover:bg-amber-100"
                            }`}
                            title="クリックしてメールを入力"
                          >
                            {r.email ?? "メール未設定"}
                          </button>
                        )}
                        {!r.email && editingEmail !== r.id && r.website && (
                          <button
                            onClick={() => findEmail(r)}
                            disabled={findingId === r.id}
                            title="サイトに書かれているメールアドレスを探します（推測はしません）"
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 border border-zinc-200 rounded px-1.5 py-0.5 hover:bg-zinc-100 disabled:opacity-40 transition-colors"
                          >
                            {findingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                            サイトから探す
                          </button>
                        )}
                        {r.businessNote && (
                          <span className="text-[11px] text-zinc-400 truncate">· {r.businessNote}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-300 mt-1 tabular-nums">
                        追加 {fmt(r.createdAt)}
                        {r.sentAt && <> · 送信 {fmt(r.sentAt)}</>}
                        {r.repliedAt && <> · 返信 {fmt(r.repliedAt)}</>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={rowDirection[r.id] ?? direction}
                        onChange={(e) => setRowDirection((p) => ({ ...p, [r.id]: e.target.value as DirectionKey }))}
                        title="この会社への訴求の方向性"
                        className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      >
                        {DIRECTIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                      </select>
                      <button
                        onClick={() => genDraft(r)} disabled={draftingId === r.id || !!banned}
                        title={banned ? "営業お断りの記載があるため作成できません" : undefined}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        {draftingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {r.draftBody ? "作り直す" : "AI下書き"}
                      </button>
                      {r.draftBody && !banned && (
                        <button onClick={() => openGmail(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors">
                          <Mail className="w-3.5 h-3.5" />Gmailで開く
                        </button>
                      )}
                      {!banned && (
                        <button
                          onClick={() => markBlocked(r)}
                          title="このサイトに営業お断りの記載を見つけたら押してください（全社に共有されます）"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] text-zinc-400 border border-zinc-200 rounded-lg hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />お断り登録
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
                      <p className="text-[11px] font-medium text-zinc-500 mb-1">件名</p>
                      <input
                        value={editBody[r.id]?.subject ?? r.draftSubject ?? ""}
                        onChange={(e) => setEditBody((p) => ({
                          ...p, [r.id]: { subject: e.target.value, body: p[r.id]?.body ?? r.draftBody ?? "" },
                        }))}
                        className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      />
                      <p className="text-[11px] font-medium text-zinc-500 mb-1">本文</p>
                      <textarea
                        rows={10}
                        value={editBody[r.id]?.body ?? r.draftBody ?? ""}
                        onChange={(e) => setEditBody((p) => ({
                          ...p, [r.id]: { subject: p[r.id]?.subject ?? r.draftSubject ?? "", body: e.target.value },
                        }))}
                        className="w-full text-xs leading-relaxed border border-zinc-200 rounded-lg px-2.5 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => saveDraft(r)}
                          disabled={savingId === r.id || !editBody[r.id]}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {savingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          保存
                        </button>
                        {editBody[r.id] && (
                          <button
                            onClick={() => setEditBody((p) => { const n = { ...p }; delete n[r.id]; return n; })}
                            className="text-[11px] text-zinc-400 hover:text-zinc-700 px-2 py-1.5"
                          >
                            変更を取り消す
                          </button>
                        )}
                        <span className="text-[10px] text-zinc-400">
                          そのまま「Gmailで開く」と、ここで直した内容が入ります
                        </span>
                      </div>
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
