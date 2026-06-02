"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Mail, Trash2, Send } from "lucide-react";
import { addOutreachLeads, saveOutreachDraft, updateOutreachStatus, deleteOutreachLead } from "@/lib/actions/outreach";
import type { OutreachStatus } from "@/generated/prisma/client";

type Row = {
  id: string; companyName: string; contactName: string | null; email: string | null; website: string | null;
  businessNote: string | null; draftSubject: string | null; draftBody: string | null;
  status: OutreachStatus; ownerName: string | null; createdAt: string;
};

const STATUS: { value: OutreachStatus; label: string; cls: string }[] = [
  { value: "NEW", label: "未着手", cls: "bg-zinc-100 text-zinc-600" },
  { value: "DRAFTED", label: "下書き済", cls: "bg-violet-100 text-violet-700" },
  { value: "SENT", label: "送信済", cls: "bg-blue-100 text-blue-700" },
  { value: "REPLIED", label: "返信", cls: "bg-emerald-100 text-emerald-700" },
  { value: "MEETING", label: "商談", cls: "bg-amber-100 text-amber-700" },
  { value: "OPTOUT", label: "配信停止", cls: "bg-red-100 text-red-700" },
  { value: "DEAD", label: "見込なし", cls: "bg-zinc-100 text-zinc-400" },
];
const statusLabel = (s: OutreachStatus) => STATUS.find((x) => x.value === s) ?? STATUS[0];

export function OutreachBoard({ initialRows, isAdmin }: { initialRows: Row[]; isAdmin: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paste, setPaste] = useState("");
  const [draftingId, setDraftingId] = useState<string | null>(null);

  const kpi = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of initialRows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [initialRows]);

  function addLeads() {
    if (!paste.trim()) return;
    startTransition(async () => {
      const res = await addOutreachLeads(paste);
      if (res.error) { alert(res.error); return; }
      alert(`${res.added}件 追加${res.skipped ? `（配信停止${res.skipped}件スキップ）` : ""}`);
      setPaste("");
      router.refresh();
    });
  }

  async function genDraft(r: Row) {
    setDraftingId(r.id);
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: r.companyName, contactName: r.contactName, businessNote: r.businessNote, website: r.website }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "下書き生成に失敗しました"); return; }
      await saveOutreachDraft(r.id, data.subject ?? "", data.body ?? "");
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
    // 送信は人が行う。開いたら「送信済」に進めやすいよう案内のみ。
  }

  function setStatus(id: string, status: OutreachStatus) {
    startTransition(async () => { await updateOutreachStatus(id, status); router.refresh(); });
  }
  function del(id: string) {
    if (!confirm("削除しますか？")) return;
    startTransition(async () => { await deleteOutreachLead(id); router.refresh(); });
  }

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STATUS.slice(0, 6).map((s) => (
          <div key={s.value} className="bg-white border border-zinc-200 rounded-lg px-3 py-2">
            <p className="text-[10px] text-zinc-500">{s.label}</p>
            <p className="text-lg font-bold text-zinc-800">{kpi[s.value] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* リード追加 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-zinc-600 mb-2">リードを追加（1行1社・「会社名, メール, 事業メモ」）</p>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4} placeholder={"例:\n株式会社サンプル, info@sample.co.jp, 地元スーパー3店舗運営\n○○工務店, , 注文住宅・リフォーム"} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white font-mono" />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={addLeads} disabled={isPending || !paste.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-lg hover:bg-sky-700 disabled:opacity-60">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}追加
          </button>
          <span className="text-[11px] text-zinc-400">※ 配信停止リストのメールは自動でスキップされます</span>
        </div>
      </div>

      {/* リスト */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {initialRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">まだありません。上の欄からリードを追加してください。</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {initialRows.map((r) => {
              const badge = statusLabel(r.status);
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-zinc-900">{r.companyName}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                        {isAdmin && r.ownerName && <span className="text-[10px] text-zinc-400">担当:{r.ownerName}</span>}
                      </div>
                      <p className="text-[11px] text-zinc-400">{[r.email, r.businessNote].filter(Boolean).join("・")}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => genDraft(r)} disabled={draftingId === r.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 text-white text-[11px] font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60">
                        {draftingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{r.draftBody ? "再生成" : "AI下書き"}
                      </button>
                      {r.draftBody && (
                        <button onClick={() => openGmail(r)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-600 text-white text-[11px] font-semibold rounded-lg hover:bg-sky-700">
                          <Mail className="w-3.5 h-3.5" />Gmailで開く
                        </button>
                      )}
                      <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as OutreachStatus)} className="text-[11px] border border-zinc-200 rounded-lg px-1.5 py-1 bg-white">
                        {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <button onClick={() => del(r.id)} className="text-zinc-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {r.draftBody && (
                    <div className="mt-2 bg-zinc-50 border border-zinc-100 rounded-lg p-2.5">
                      <p className="text-[11px] font-semibold text-zinc-600">件名: {r.draftSubject}</p>
                      <p className="text-[11px] text-zinc-600 whitespace-pre-wrap mt-1 leading-relaxed">{r.draftBody}</p>
                      <p className="text-[10px] text-zinc-400 mt-1.5 flex items-center gap-1"><Send className="w-2.5 h-2.5" />「Gmailで開く」→ 内容を確認・ご自身の署名を付けて送信 → ステータスを「送信済」に</p>
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
