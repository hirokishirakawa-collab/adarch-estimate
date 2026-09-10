"use client";

// 郵送DMの材料を作る（画面版）。AI連携 prepare_dm と同じAPI・同じ記録
import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, FileText, FileSpreadsheet, ExternalLink, AlertTriangle, CheckCircle2, Mailbox } from "lucide-react";
import { TVER_FLYER_TEMPLATES } from "@/lib/constants/tver-flyer";

interface LeadRow {
  id: string;
  name: string;
  address: string | null;
  prefecture: string | null;
  industry: string | null;
  hasPostal: boolean;
  warn: string | null;
}

interface Result {
  area: string;
  counts: { ready: number; needsFix: number; skipped: number };
  files: { flyerPdf: string | null; webletterCsv: string; genericCsv: string; note: string | null };
  needsFix: { leadId: string; name: string; address: string; reason: string | null }[];
  skipped: { leadId: string; name: string; reason: string }[];
  send: { label: string; url: string; how: string; csv: string }[];
  estimate: { webletterColorA4x1: string };
  recorded: { sentAt: string; leads: number; ledger: string };
  steps: string[];
}

interface Props {
  leads: LeadRow[];
  prefectures: string[];
  municipalities: Record<string, { code: string; name: string }[]>;
  defaultPrefecture: string;
  industries: string[];
  defaultLandingUrl: string;
}

export function DmKitForm({ leads, prefectures, municipalities, defaultPrefecture, industries, defaultLandingUrl }: Props) {
  const usable = useMemo(() => leads.filter((l) => !l.warn), [leads]);
  const [pref, setPref] = useState(defaultPrefecture);
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState(industries[0] ?? "");
  const [catchCopy, setCatchCopy] = useState("");
  const [landingUrl, setLandingUrl] = useState(defaultLandingUrl);
  const [template, setTemplate] = useState<string>("orange");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const munis = municipalities[pref] ?? [];

  const submit = async () => {
    if (!pref || !city) {
      setError("チラシに載せる商圏（県・市区町村）を選んでください");
      return;
    }
    if (!confirm(`${usable.length}件を「送付」として記録し、宛先CSVとチラシPDFを作ります。よろしいですか？（発送はこのあと代表が行います）`)) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/dm/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadIds: usable.map((l) => l.id), prefecture: pref, city, industry: industry || undefined, catchCopy: catchCopy || undefined, landingUrl: landingUrl || undefined, template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "失敗しました");
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300";

  return (
    <div className="space-y-5">
      {/* 相手先 */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <p className="text-sm font-bold text-zinc-800">送り先 {usable.length}件{leads.length !== usable.length ? `（${leads.length - usable.length}件は対象外）` : ""}</p>
          <p className="text-[11px] text-zinc-500">郵便番号が住所に無い会社は自動で補います。取れない先は結果に「手で補う先」として出ます</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {leads.map((l) => (
            <div key={l.id} className={`grid grid-cols-[1fr_2fr_90px] gap-2 px-4 py-1.5 text-xs border-b border-zinc-50 ${l.warn ? "opacity-50" : ""}`}>
              <span className="font-medium text-zinc-800 truncate">{l.name}</span>
              <span className="text-zinc-500 truncate">{l.address ?? "—"}</span>
              <span className="text-right">{l.warn ? <span className="text-rose-600">{l.warn}</span> : l.hasPostal ? <span className="text-emerald-700">〒あり</span> : <span className="text-zinc-400">〒補完</span>}</span>
            </div>
          ))}
        </div>
      </div>

      {/* チラシの設定 */}
      {!result && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
          <p className="text-sm font-bold text-zinc-800">チラシの中身</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <select value={pref} onChange={(e) => { setPref(e.target.value); setCity(""); }} className={inputCls}>
              <option value="">県を選ぶ</option>
              {prefectures.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} disabled={!pref}>
              <option value="">商圏の市区町村（チラシの数字の元）</option>
              {munis.map((m) => <option key={m.code} value={m.name}>{m.name}</option>)}
            </select>
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="相手の業種（例: 歯科）" className={inputCls} list="dm-industries" />
            <datalist id="dm-industries">{industries.map((i) => <option key={i} value={i} />)}</datalist>
          </div>
          <input value={catchCopy} onChange={(e) => setCatchCopy(e.target.value)} maxLength={40} placeholder="ひとこと（40字以内・金額なし。例: 地元のお客様に、テレビ画面で。）" className={inputCls} />
          <div>
            <input value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="QRの飛び先URL（TVer申込ページ／業種×市のLP）" className={inputCls} />
            <p className="text-[10px] text-zinc-400 mt-1">既定は貴社が案内元になるTVer申込ページ。空にするとQRなし</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TVER_FLYER_TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => setTemplate(t.key)} className={`px-3 py-1.5 rounded-lg border text-xs ${template === t.key ? "bg-zinc-800 text-white border-zinc-800" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`} title={t.desc}>
                {t.label}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-zinc-500">押すと {usable.length}件が「送付」として記録されます（メール・フォームと同じ台帳・チャネルは郵送DM）</p>
            <button onClick={submit} disabled={loading || usable.length === 0} className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mailbox className="w-4 h-4" />} 宛先CSVとチラシを作る
            </button>
          </div>
          {loading && <p className="text-xs text-zinc-500">郵便番号の補完とチラシPDFの生成中（30秒〜1分）…</p>}
        </div>
      )}

      {/* 結果 */}
      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {result.area}向けの材料ができました（送れる {result.counts.ready}件／手で補う {result.counts.needsFix}件／対象外 {result.counts.skipped}件）</p>
            <p className="text-[11px] text-emerald-700 mt-1">{result.recorded.ledger}（{result.recorded.sentAt}）</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            {result.files.flyerPdf ? (
              <a href={result.files.flyerPdf} target="_blank" rel="noopener" className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
                <FileText className="w-5 h-5 text-orange-600" />
                <p className="text-sm font-bold text-zinc-800 mt-2">チラシPDF（A4）</p>
                <p className="text-[11px] text-zinc-500">貴社名・QR入り。まず中身を確認</p>
              </a>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">{result.files.note}</div>
            )}
            <a href={result.files.webletterCsv} className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-bold text-zinc-800 mt-2">Webレター用 宛先CSV</p>
              <p className="text-[11px] text-zinc-500">日本郵便の形式（Shift-JIS・見出しなし）。そのままアップロード</p>
            </a>
            <a href={result.files.genericCsv} className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
              <FileSpreadsheet className="w-5 h-5 text-zinc-600" />
              <p className="text-sm font-bold text-zinc-800 mt-2">汎用 宛名CSV</p>
              <p className="text-[11px] text-zinc-500">ラクスルDM等の宛名テンプレに貼り替える用（要確認の印つき）</p>
            </a>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
            <p className="text-sm font-bold text-zinc-800">発送する</p>
            {result.send.map((s) => (
              <div key={s.url} className="rounded-lg border border-zinc-100 p-3">
                <a href={s.url} target="_blank" rel="noopener" className="text-sm font-bold text-blue-700 hover:underline inline-flex items-center gap-1">{s.label} <ExternalLink className="w-3.5 h-3.5" /></a>
                <p className="text-[11px] text-zinc-600 mt-1">{s.how}</p>
                <p className="text-[11px] text-zinc-400">{s.csv}</p>
              </div>
            ))}
            <p className="text-[11px] text-zinc-500">概算（Webレター・カラーA4 1枚）: {result.estimate.webletterColorA4x1}</p>
            <ol className="list-decimal pl-5 text-xs text-zinc-600 space-y-0.5">
              {result.steps.map((s) => <li key={s}>{s.replace(/^\d\)\s*/, "")}</li>)}
            </ol>
          </div>

          {result.needsFix.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> 手で補う先（{result.needsFix.length}件・CSVには入っていません）</p>
              <div className="mt-2 space-y-1">
                {result.needsFix.map((n) => (
                  <div key={n.leadId} className="text-xs text-zinc-700 grid grid-cols-[1fr_2fr_1fr] gap-2">
                    <span className="font-medium truncate">{n.name}</span><span className="text-zinc-500 truncate">{n.address}</span><span className="text-amber-700">{n.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.skipped.length > 0 && (
            <p className="text-[11px] text-zinc-400">対象外: {result.skipped.map((s) => `${s.name}（${s.reason}）`).join("、")}</p>
          )}
          <p className="text-xs text-zinc-500">
            届いたあとの返事は <Link href="/dashboard/leads/awaiting" className="text-blue-700 underline">返事待ち（結果入力）</Link> で「返信あり／NG／無反応」を押してください。
          </p>
        </div>
      )}
    </div>
  );
}
