"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TverOrderStatus } from "@/generated/prisma/client";
import { MONTH_OPTIONS, TVER_ORDER_PLANS, TVER_ORDER_STATUS_LABEL } from "@/lib/tver-order/plans";
import { confirmPaymentManually, issueNextInvoice, issueTverOrderDocument, markTverConsulted, recordTverPreReview, reissueInvoice, saveTverReviewInfo, syncMfPayment, updateTverOrder } from "@/lib/actions/tver-orders";

const FLOW: TverOrderStatus[] = ["PAID", "REVIEWING", "MATERIAL_WAITING", "MATERIAL_RECEIVED", "LIVE", "COMPLETED"];
const NEXT_HINT: Partial<Record<TverOrderStatus, string>> = {
  PAID: "お客様の詳細（法人番号・所在地・代表者）が揃ったら、TVerへ業態考査を申請して「考査中」へ",
  REVIEWING: "考査が通ったら「動画の受付中」へ（お客様に動画提出のメールが飛ぶ）。不可なら「返金済」へ",
  MATERIAL_WAITING: "動画が届いたら自動で「入稿準備中」になる。届かない時はお客様へ連絡文",
  MATERIAL_RECEIVED: "規定チェック→入稿→配信開始日を入れて「配信中」へ",
  LIVE: "終了したらレポートURLを入れて「配信終了・レポート済」へ",
};

export function OrderAdminPanel(p: {
  id: string; status: TverOrderStatus; paid: boolean; paymentMethod: "CARD" | "BANK_TRANSFER"; detailsDone: boolean;
  customerNote: string; adminNote: string; liveStartDate: string; liveEndDate: string; reportUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<TverOrderStatus>(p.status);
    const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? `⚠️ ${r.error}` : r.message ?? "保存しました");
      router.refresh();
    });
  const idx = FLOW.indexOf(p.status);
  const suggested = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

  return (
    <div className="space-y-4">
      {!p.paid && (
        <section className="bg-white border border-orange-200 rounded-xl p-5 text-sm text-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">初月の入金待ち</h2>
          <p className="text-xs text-zinc-500">{p.paymentMethod === "BANK_TRANSFER" ? "左の「月ごとの請求」で「MFの入金を取込」か、通帳で確認できたら「入金を確定」を押してください。" : "カード決済はSquareのWebhookで自動確定します。反映されない時だけ左の「月ごとの請求」から手動で確定してください。"}</p>
        </section>
      )}

      <form
        className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3"
        action={(fd) => run(() => updateTverOrder(p.id, fd))}
      >
        <h2 className="text-sm font-semibold text-zinc-900">状態を進める</h2>
        {NEXT_HINT[p.status] && <p className="text-xs text-zinc-500 bg-zinc-50 rounded-lg p-2">{NEXT_HINT[p.status]}</p>}
        {p.status === "PAID" && !p.detailsDone && <p className="text-xs text-orange-700">お客様の詳細記入がまだです（法人番号がないと考査を申請できません）</p>}
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value as TverOrderStatus)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white" disabled={!p.paid}>
          {(Object.keys(TVER_ORDER_STATUS_LABEL) as TverOrderStatus[]).filter((s) => !["CONSULTING", "PRE_REVIEWING", "ORDER_ISSUED", "AWAITING_PAYMENT"].includes(s)).map((s) => (
            <option key={s} value={s}>{TVER_ORDER_STATUS_LABEL[s]}{s === suggested ? "（次）" : ""}</option>
          ))}
        </select>
        {(status === "LIVE" || status === "COMPLETED") && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-zinc-500">配信開始<input type="date" name="liveStartDate" defaultValue={p.liveStartDate} className="mt-1 w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-zinc-500">配信終了<input type="date" name="liveEndDate" defaultValue={p.liveEndDate} className="mt-1 w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm" /></label>
          </div>
        )}
        {status === "COMPLETED" && (
          <label className="block text-xs text-zinc-500">月次レポートURL<input type="url" name="reportUrl" defaultValue={p.reportUrl} placeholder="https://" className="mt-1 w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-sm" /></label>
        )}
        <label className="block text-xs text-zinc-500">お客様へのご連絡（進捗ページとメールに出る）<textarea name="customerNote" defaultValue={p.customerNote} rows={3} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" placeholder="例: 考査のため事業内容の分かる資料（会社案内など）をご返信ください" /></label>
        <label className="block text-xs text-zinc-500">本部メモ（内部）<textarea name="adminNote" defaultValue={p.adminNote} rows={2} className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" /></label>
        <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" name="notify" value="1" defaultChecked /> お客様へメールで知らせる</label>
        <button type="submit" disabled={pending || !p.paid} className="w-full px-3 py-2 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-40">保存して進める</button>
        {!p.paid && <p className="text-xs text-zinc-400">初月の入金確認前は状態を進められません（取り下げは一覧の一括操作から）</p>}
      </form>
      {msg && <p className="text-sm text-zinc-700 bg-zinc-50 rounded-lg p-3">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------
// 月ごとの請求（入金確定・MF取込・再発行・次月発行）
// ---------------------------------------------------------------
type InvoiceRow = {
  id: string; seq: number; amountInclTax: number; includesSetupFee: boolean; method: "CARD" | "BANK_TRANSFER"; status: "UNPAID" | "PAID" | "CANCELLED";
  dueDate: string; paidAt: string | null; paymentNote: string | null; squareLinkUrl: string | null; mfBillingNumber: string | null; mfPdfUrl: string | null;
};
const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }) : "—");

export function InvoiceList({ orderId, invoices, canIssueNext }: { orderId: string; invoices: InvoiceRow[]; canIssueNext: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? `⚠️ ${r.error}` : r.message ?? "保存しました");
      router.refresh();
    });
  const hasBank = invoices.some((i) => i.method === "BANK_TRANSFER" && i.status === "UNPAID");
  return (
    <div className="space-y-2 text-sm">
      <table className="w-full text-sm">
        <thead className="text-xs text-zinc-500"><tr><th className="text-left py-1">月</th><th className="text-right py-1">税込</th><th className="text-left py-1 pl-3">期限</th><th className="text-left py-1 pl-3">状況</th><th className="py-1"></th></tr></thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className="border-t border-zinc-100">
              <td className="py-1.5 whitespace-nowrap">{i.seq}ヶ月目{i.includesSetupFee ? <span className="text-xs text-zinc-400 ml-1">初期登録費込</span> : null}</td>
              <td className="py-1.5 text-right tabular-nums">¥{i.amountInclTax.toLocaleString("ja-JP")}</td>
              <td className="py-1.5 pl-3 whitespace-nowrap text-zinc-500">{d(i.dueDate)}</td>
              <td className="py-1.5 pl-3">
                {i.status === "PAID" ? <span className="text-emerald-700">✓ {d(i.paidAt)}{i.paymentNote ? <span className="text-xs text-zinc-400 ml-1">{i.paymentNote}</span> : null}</span> : i.status === "CANCELLED" ? <span className="text-zinc-400">取消</span> : <span className="text-orange-700">未入金{i.method === "BANK_TRANSFER" ? (i.mfBillingNumber ? `・MF ${i.mfBillingNumber}` : "・請求書未発行") : i.squareLinkUrl ? "・リンク済" : "・リンク未作成"}</span>}
                {i.mfPdfUrl && <a href={i.mfPdfUrl} target="_blank" rel="noopener" className="text-xs text-orange-600 underline ml-2">PDF</a>}
                {i.squareLinkUrl && i.status === "UNPAID" && <a href={i.squareLinkUrl} target="_blank" rel="noopener" className="text-xs text-orange-600 underline ml-2">決済リンク</a>}
              </td>
              <td className="py-1.5 text-right whitespace-nowrap">
                {i.status === "UNPAID" && (
                  <>
                    <button type="button" disabled={pending} onClick={() => run(() => reissueInvoice(i.id))} className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-zinc-50 mr-1">{i.method === "BANK_TRANSFER" ? "請求書を再発行" : "リンク再発行"}</button>
                    <button type="button" disabled={pending} onClick={() => { if (confirm(`${i.seq}ヶ月目 ¥${i.amountInclTax.toLocaleString("ja-JP")} の入金を確定します。よろしいですか？`)) run(() => confirmPaymentManually(i.id, note)); }} className="text-xs px-2 py-1 rounded bg-orange-500 text-white">入金を確定</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="手動確定のメモ（例: 9/12 UFJ入金）" className="flex-1 min-w-[200px] border border-zinc-200 rounded-lg px-3 py-1.5 text-xs" />
        {hasBank && <button type="button" disabled={pending} onClick={() => run(() => syncMfPayment(orderId))} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 text-white">MFの入金を取込</button>}
        {canIssueNext && <button type="button" disabled={pending} onClick={() => run(() => issueNextInvoice(orderId))} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200">次の月の請求を今すぐ発行</button>}
      </div>
      <p className="text-xs text-zinc-400">2ヶ月目以降は毎朝のcronが、配信開始日の応当日の7日前に自動で発行・メールします（配信開始日を入れてから）。</p>
      {msg && <p className="text-xs text-zinc-700 bg-zinc-50 rounded-lg p-2">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------
// 相談の段（2026-09-14〜）: ① 面談・電話 → ② 業態考査 → ③ 発注書（本部だけ）
// ---------------------------------------------------------------
export function ConsultPanel(p: {
  id: string; status: TverOrderStatus; consultNote: string;
  websiteUrl: string; corporateNumber: string; hasNoCorporateNumber: boolean; productName: string; productUrl: string;
  reviewSubmitted: boolean; reviewApproved: boolean; orderIssued: boolean;
  planKey: string; months: number; hasVideo: boolean; pdfUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState(p.consultNote);
  const [reviewNote, setReviewNote] = useState("");
  const [noCorp, setNoCorp] = useState(p.hasNoCorporateNumber);
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? `⚠️ ${r.error}` : r.message ?? "保存しました");
      router.refresh();
    });
  const box = "bg-white border border-zinc-200 rounded-xl p-5 space-y-3";
  const input = "w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm";
  const editableInfo = p.status === "CONSULTING" || p.status === "PRE_REVIEWING";

  return (
    <div className="space-y-4">
      <section className={box}>
        <h2 className="text-sm font-semibold text-zinc-900">① 面談・お電話</h2>
        {p.status === "CONSULTING" ? (
          <>
            <p className="text-xs text-zinc-500 bg-zinc-50 rounded-lg p-2">案内元（なければ本部）が連絡して、目的・エリア・プラン・動画の有無を確認。済んだら記録を残して「面談済み」へ。考査の情報が未記入なら、お客様へ記入のお願いメールが飛びます。</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={input} placeholder="例: 9/16 電話。モデルハウス見学会の告知・高山市のみ・スタンダード6ヶ月で検討・動画は既存の30秒を15秒に編集希望" />
            <button type="button" disabled={pending} onClick={() => run(() => markTverConsulted(p.id, note))} className="w-full px-3 py-2 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-40">面談済みにする</button>
          </>
        ) : (
          <p className="text-xs text-emerald-700">✓ 面談済み{p.consultNote ? <span className="block text-zinc-600 whitespace-pre-wrap mt-1">{p.consultNote}</span> : null}</p>
        )}
      </section>

      <section className={box}>
        <h2 className="text-sm font-semibold text-zinc-900">② 業態考査（お支払い前）</h2>
        <form action={(fd) => run(() => saveTverReviewInfo(p.id, fd))} className="space-y-2">
          <label className="block text-xs text-zinc-500">企業ページURL<input name="websiteUrl" defaultValue={p.websiteUrl} className={input} disabled={!editableInfo} /></label>
          <label className="block text-xs text-zinc-500">法人番号（13桁）<input name="corporateNumber" defaultValue={p.corporateNumber} className={input} disabled={!editableInfo || noCorp} inputMode="numeric" maxLength={13} /></label>
          <label className="flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" name="hasNoCorporateNumber" checked={noCorp} onChange={(e) => setNoCorp(e.target.checked)} disabled={!editableInfo} /> 法人番号なし</label>
          <label className="block text-xs text-zinc-500">商材名／キャンペーン名<input name="productName" defaultValue={p.productName} className={input} disabled={!editableInfo} /></label>
          <label className="block text-xs text-zinc-500">商材サイトURL<input name="productUrl" defaultValue={p.productUrl} className={input} disabled={!editableInfo} /></label>
          {editableInfo && <button type="submit" disabled={pending} className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm">考査の情報を保存</button>}
        </form>
        {p.status === "PRE_REVIEWING" && (
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">{p.reviewApproved ? "✓ 考査OK" : p.reviewSubmitted ? "TVerへ申請済み・結果待ち" : "上の5項目でTVerの業態考査フォームに申請"}</p>
            <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} className={input} placeholder="見送りの時のお客様への一言（任意）" />
            <div className="grid grid-cols-3 gap-2">
              <button type="button" disabled={pending || p.reviewSubmitted} onClick={() => run(() => recordTverPreReview(p.id, "SUBMITTED", ""))} className="px-2 py-2 rounded-lg border border-zinc-200 text-xs disabled:opacity-40">申請した</button>
              <button type="button" disabled={pending || p.reviewApproved} onClick={() => run(() => recordTverPreReview(p.id, "APPROVED", ""))} className="px-2 py-2 rounded-lg bg-emerald-600 text-white text-xs disabled:opacity-40">考査OK</button>
              <button type="button" disabled={pending} onClick={() => { if (confirm("見送りにします（お客様へメール・お支払いは発生していません）。よろしいですか？")) run(() => recordTverPreReview(p.id, "REJECTED", reviewNote)); }} className="px-2 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs">見送り</button>
            </div>
          </div>
        )}
      </section>

      <section className={box}>
        <h2 className="text-sm font-semibold text-zinc-900">③ 発注書（本部だけ）</h2>
        {p.orderIssued && <p className="text-xs text-emerald-700">✓ 発行済み・お客様の署名待ち　<a className="underline text-orange-600" href={p.pdfUrl} target="_blank" rel="noopener">発注書PDF</a></p>}
        {(p.reviewApproved || p.orderIssued) ? (
          <form action={(fd) => { if (confirm(`発注書を${p.orderIssued ? "作り直して再送" : "発行してお客様へメール"}します。よろしいですか？`)) run(() => issueTverOrderDocument(p.id, fd)); }} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-zinc-500">プラン
                <select name="planKey" defaultValue={p.planKey} className={input}>
                  {TVER_ORDER_PLANS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-zinc-500">契約期間
                <select name="months" defaultValue={String(p.months)} className={input}>
                  {MONTH_OPTIONS.map((m) => <option key={m.months} value={m.months}>{m.label}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" name="hasVideo" defaultChecked={p.hasVideo} /> 15秒の動画はお客様が用意</label>
            <p className="text-xs text-zinc-400">金額はエリアの人口とOSの料金で自動計算します（このエリアで選べないプラン・期間はエラーで止まります）。</p>
            <button type="submit" disabled={pending} className="w-full px-3 py-2 rounded-lg bg-orange-500 text-white text-sm disabled:opacity-40">{p.orderIssued ? "発注書を作り直して再送" : "発注書を発行してメール"}</button>
          </form>
        ) : (
          <p className="text-xs text-zinc-400">業態考査がOKになると発行できます</p>
        )}
      </section>
      {msg && <p className="text-sm text-zinc-700 bg-zinc-50 rounded-lg p-3">{msg}</p>}
    </div>
  );
}
