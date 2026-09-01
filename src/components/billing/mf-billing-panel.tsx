"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { createMfBillingForInvoiceRequest, syncMfPaymentForInvoiceRequest } from "@/lib/actions/billing-mf";

const MF_PAY_LABEL: Record<number, string> = { 0: "未設定", 1: "未入金", 2: "入金済み", 3: "未払い", 4: "振込済み" };

export function MfBillingPanel({ requestId, defaultBillingDate, dueDate, mf, status }: {
  requestId: string;
  defaultBillingDate: string; // YYYY-MM-DD
  dueDate: string | null;
  mf: { billingId: string | null; billingNumber: string | null; paymentStatus: number | null; squareUrl: string | null; squareAmount: number | null; amountInclTax: number };
  status: { squareConfigured: boolean; mfConfigured: boolean; mfConnected: boolean };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [billingDate, setBillingDate] = useState(defaultBillingDate);
  const [withCard, setWithCard] = useState(status.squareConfigured);
  const [msg, setMsg] = useState<string | null>(null);

  function create() {
    if (!confirm(`MFクラウド請求書に請求書を作成します（請求日 ${billingDate.replace(/-/g, "/")}${withCard ? "・カード決済リンク付き" : ""}）。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await createMfBillingForInvoiceRequest({ id: requestId, billingDate, withCardLink: withCard });
      if (res.error) { setMsg(`エラー: ${res.error}`); return; }
      setMsg(`MF請求書 ${res.billingNumber} を作成しました${res.partnerCreated ? "（MFに取引先を新規作成）" : ""}${res.squareUrl ? `／カード決済: ${res.squareUrl}` : ""}`);
      router.refresh();
    });
  }
  function sync() {
    startTransition(async () => {
      const res = await syncMfPaymentForInvoiceRequest(requestId);
      if (res.error) { setMsg(`エラー: ${res.error}`); return; }
      setMsg(`MF入金状況: ${res.status != null ? (MF_PAY_LABEL[res.status] ?? res.status) : "不明"}${res.markedPaid ? " → この申請を支払済みにしました" : ""}`);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p className="text-sm font-bold text-zinc-800 flex items-center gap-1.5"><FileText className="w-4 h-4 text-indigo-600" />MFクラウド請求書（本部専用）</p>
        {!status.mfConfigured ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle className="w-3 h-3" />MF未設定</span>
        ) : !status.mfConnected ? (
          <a href="/api/mf/connect" className="text-[11px] text-indigo-700 underline">MFに接続</a>
        ) : null}
      </div>
      {mf.billingId ? (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-zinc-700">
            請求書番号 <span className="font-mono font-semibold">{mf.billingNumber ?? mf.billingId}</span>
            <span className={`ml-3 text-xs px-2 py-0.5 rounded-full border ${mf.paymentStatus === 2 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
              {mf.paymentStatus != null ? (MF_PAY_LABEL[mf.paymentStatus] ?? `状態${mf.paymentStatus}`) : "—"}
            </span>
            {mf.squareUrl && (
              <a href={mf.squareUrl} target="_blank" rel="noreferrer" className="ml-3 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"><ExternalLink className="w-3 h-3" />カード決済リンク{mf.squareAmount !== mf.amountInclTax ? "（金額変更あり）" : ""}</a>
            )}
          </div>
          <button onClick={sync} disabled={isPending || !status.mfConnected} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 disabled:opacity-50">
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}MF入金状況を取込
          </button>
        </div>
      ) : (
        <div className="flex items-center flex-wrap gap-3">
          <label className="inline-flex items-center gap-1 text-xs text-zinc-600">請求日
            <input type="date" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} className="px-2 py-1 text-xs border border-zinc-200 rounded bg-white" />
          </label>
          <span className="text-xs text-zinc-500">支払期限 {dueDate ? dueDate.replace(/-/g, "/") : <span className="text-red-600">未設定（申請を編集して入れてください）</span>}</span>
          <label className="inline-flex items-center gap-1 text-xs text-zinc-600">
            <input type="checkbox" checked={withCard} onChange={(e) => setWithCard(e.target.checked)} disabled={!status.squareConfigured} />
            カード決済リンクを付ける（Square・先に作成して備考に記載）
          </label>
          <button onClick={create} disabled={isPending || !status.mfConnected || !dueDate} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}MFに請求書を作成
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-[11px] text-zinc-600">{msg}</p>}
      <p className="mt-2 text-[10px] text-zinc-400">請求書の送付はMF画面から（メール送信APIはありません）。備考には内訳・税込額・カード決済リンク・振込案内が入ります。</p>
    </div>
  );
}
