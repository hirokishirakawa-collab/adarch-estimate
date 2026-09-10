"use client";

// 郵送DMの材料1件: 3ファイル・発送先・手で補う先・発送済みチェック・削除
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, FileSpreadsheet, ExternalLink, AlertTriangle, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { DM_SEND_LINKS } from "@/lib/constants/tver-flyer";

interface Kit {
  id: string;
  prefecture: string;
  city: string;
  industry: string | null;
  catchCopy: string | null;
  landingUrl: string | null;
  template: string;
  flyerUrl: string | null;
  flyerSource: string;
  source: string;
  webletterCsvUrl: string;
  genericCsvUrl: string;
  readyCount: number;
  needsFixCount: number;
  skippedCount: number;
  leadIds: string[];
  needsFix: { leadId: string; name: string; address: string; reason: string | null }[] | null;
  skipped: { leadId: string; name: string; reason: string }[] | null;
  sentAt: string | null;
  sentVia: string | null;
  sentNote: string | null;
  createdByName: string;
  createdAt: string;
}
const fmt = (s: string) => new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(s));

export function DmKitDetail({ kit: initial }: { kit: Kit }) {
  const router = useRouter();
  const [kit, setKit] = useState(initial);
  const [sentVia, setSentVia] = useState(initial.sentVia ?? "ラクスルDM");
  const [sentNote, setSentNote] = useState(initial.sentNote ?? "");
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/dm/kits/${kit.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { alert((await res.json()).error ?? "失敗しました"); return; }
    const out = await res.json();
    setKit({ ...kit, ...out });
  };
  const remove = async () => {
    if (!confirm("この履歴を削除します。ファイルの再ダウンロードができなくなります（リードの送付記録は残ります）。よろしいですか？")) return;
    setBusy(true);
    const res = await fetch(`/api/dm/kits/${kit.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { alert("削除に失敗しました"); return; }
    router.push("/dashboard/leads/dm");
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${kit.sentAt ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200 bg-white"}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-bold text-zinc-800">{kit.prefecture} {kit.city}{kit.industry ? `・${kit.industry}` : ""} ／ {kit.readyCount}通</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{fmt(kit.createdAt)} に {kit.createdByName} が{kit.source === "AI" ? "AI連携" : "画面"}で作成 ／ チラシ: {kit.flyerSource === "UPLOADED" ? "自作PDF" : `OSの型（${kit.template}）`}{kit.catchCopy ? ` ／ ひとこと: ${kit.catchCopy}` : ""}</p>
            {kit.landingUrl && <p className="text-[11px] text-zinc-500">QR: {kit.landingUrl}</p>}
          </div>
          <div className="flex items-center gap-2">
            {kit.sentAt ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> 発送済み {fmt(kit.sentAt)}{kit.sentVia ? `（${kit.sentVia}）` : ""}</span>
            ) : (
              <span className="text-xs text-zinc-500">未発送</span>
            )}
            <button onClick={remove} disabled={busy} title="履歴を削除" className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        {kit.flyerUrl ? (
          <a href={kit.flyerUrl} target="_blank" rel="noopener" className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
            <FileText className="w-5 h-5 text-orange-600" />
            <p className="text-sm font-bold text-zinc-800 mt-2">{kit.flyerSource === "UPLOADED" ? "チラシPDF（A4）" : "チラシのたたき台PDF（A4）"}</p>
            <p className="text-[11px] text-zinc-500">{kit.flyerSource === "UPLOADED" ? "自作のPDF" : "貴社名・QR入りの情報整理。仕上げは貴社で"}</p>
          </a>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">チラシPDFはありません（作成に失敗したか、後で用意する前提）</div>
        )}
        <a href={kit.genericCsvUrl} className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          <p className="text-sm font-bold text-zinc-800 mt-2">宛名CSV（ラクスルDM用・汎用）</p>
          <p className="text-[11px] text-zinc-500">ラクスルの宛名テンプレに貼り替える用</p>
        </a>
        <a href={kit.webletterCsvUrl} className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
          <FileSpreadsheet className="w-5 h-5 text-zinc-600" />
          <p className="text-sm font-bold text-zinc-800 mt-2">Webレター用 宛先CSV</p>
          <p className="text-[11px] text-zinc-500">急ぎ少部数向け。日本郵便の形式（Shift-JIS・見出しなし）でそのままアップロード</p>
        </a>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
        <p className="text-sm font-bold text-zinc-800">発送する（あなたが行います。本部は送りません）</p>
        {DM_SEND_LINKS.map((s) => (
          <div key={s.key} className="rounded-lg border border-zinc-100 p-3">
            <a href={s.url} target="_blank" rel="noopener" className="text-sm font-bold text-blue-700 hover:underline inline-flex items-center gap-1">{s.label} <ExternalLink className="w-3.5 h-3.5" /></a>
            <p className="text-[11px] text-zinc-600 mt-1">{s.spec}</p>
            <p className="text-[11px] text-zinc-400">{s.csvNote}</p>
          </div>
        ))}
        <p className="text-[11px] text-zinc-500">概算: ラクスルDMは仕様と通数で変わるため画面で見積る。急ぎ少部数でWebレター（カラーA4 1枚）なら ¥{(kit.readyCount * 190).toLocaleString("ja-JP")}（税込・{kit.readyCount}通×¥190）</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2">
        <p className="text-sm font-bold text-zinc-800">送ったら記録</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sentVia} onChange={(e) => setSentVia(e.target.value)} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs">
            <option>ラクスルDM</option>
            <option>Webレター</option>
            <option>自分で投函</option>
            <option>その他</option>
          </select>
          <input value={sentNote} onChange={(e) => setSentNote(e.target.value)} placeholder="メモ（通数・注文番号など）" className="flex-1 min-w-[200px] rounded-lg border border-zinc-200 px-3 py-1.5 text-xs" />
          {kit.sentAt ? (
            <button disabled={busy} onClick={() => patch({ sent: false })} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-xs">未発送に戻す</button>
          ) : (
            <button disabled={busy} onClick={() => patch({ sent: true, sentVia, sentNote })} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} 発送済みにする</button>
          )}
          {kit.sentAt && <button disabled={busy} onClick={() => patch({ sentVia, sentNote })} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-xs">メモを保存</button>}
        </div>
        <p className="text-[11px] text-zinc-500">届いたあとの返事は <Link href="/dashboard/leads/awaiting" className="text-blue-700 underline">返事待ち（結果入力）</Link> で「返信あり／NG／無反応」を押してください</p>
      </div>

      {kit.needsFix && kit.needsFix.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white p-4">
          <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> 手で補う先（{kit.needsFix.length}件・CSVには入っていません）</p>
          <div className="mt-2 space-y-1">
            {kit.needsFix.map((n) => (
              <div key={n.leadId} className="text-xs text-zinc-700 grid grid-cols-[1fr_2fr_1fr] gap-2">
                <span className="font-medium truncate">{n.name}</span><span className="text-zinc-500 truncate">{n.address}</span><span className="text-amber-700">{n.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {kit.skipped && kit.skipped.length > 0 && <p className="text-[11px] text-zinc-400">対象外: {kit.skipped.map((s) => `${s.name}（${s.reason}）`).join("、")}</p>}
    </div>
  );
}
