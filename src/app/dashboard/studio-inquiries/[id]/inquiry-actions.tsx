"use client";

// 依頼への対応: 相談中（連絡した）／見送り／確定（発注条件＝本部→県本部の 内容・金額・納期・支払日 が必須）

import { useState, useTransition } from "react";
import { confirmStudioInquiry, updateStudioInquiryStatus } from "@/lib/actions/studio-inquiries";

export function InquiryActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [scope, setScope] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? r.message ?? null);
    });
  const canConfirm = scope.trim().length >= 5 && Number(amount) > 0 && !!dueDate && !!paymentDate;

  return (
    <div className="space-y-4">
      <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900">連絡した・見送る</h2>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="メモ（誰に・何を伝えたか）" className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="flex gap-2">
          {status === "RECEIVED" && (
            <button type="button" disabled={pending} className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-40" onClick={() => run(() => updateStudioInquiryStatus(id, "CONSULTING", note))}>
              連絡した（相談中にする）
            </button>
          )}
          <button type="button" disabled={pending} className="px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 text-sm disabled:opacity-40" onClick={() => confirm("見送りにします。よろしいですか？") && run(() => updateStudioInquiryStatus(id, "DECLINED", note))}>
            見送り
          </button>
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900">確定する（発注条件の入力が必須）</h2>
        <p className="text-xs text-zinc-500">お客様との契約は本部（アドアーチ）。ここに入れるのは本部から貴社への発注の条件です。確定後は変更・削除できません。</p>
        <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} placeholder="発注の内容（何を・どれだけ）" className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm" />
        <div className="grid grid-cols-3 gap-2 text-sm">
          <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">金額（税抜・円）</span><input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="border border-zinc-200 rounded-lg px-2 py-1.5" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">納期</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border border-zinc-200 rounded-lg px-2 py-1.5" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-zinc-500">支払日</span><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="border border-zinc-200 rounded-lg px-2 py-1.5" /></label>
        </div>
        <button type="button" disabled={pending || !canConfirm} className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-sm disabled:opacity-40"
          onClick={() => confirm("この条件で確定します。よろしいですか？") && run(() => confirmStudioInquiry(id, { scope, amountExclTax: Number(amount), dueDate, paymentDate }))}>
          確定する
        </button>
      </section>
      {msg && <p className="text-sm text-zinc-700">{msg}</p>}
    </div>
  );
}
