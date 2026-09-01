"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Download, Link2, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { ensureRoyaltyPaymentLinks } from "@/lib/actions/royalty-payment-link";

// 請求書の正本はMFクラウド請求（2026-09-01 代表決定）。
// OSは金額を決めるところまで＝この一覧をMFに打ち込む（またはCSVを手元に落として突合する）。

export type MfBillingRow = {
  groupCompanyId: string;
  name: string;
  ownerName: string;
  selfRevenueExclTax: number;
  hqRevenueExclTax: number;
  royaltyExclTax: number;
  commissionExclTax: number;
  shortfallExclTax: number;
  taxAmount: number;
  totalInclTax: number;
  branchNote: string; // 複数拠点の県別内訳（単一拠点は空）
  paymentLink: { url: string; amountInclTax: number } | null; // Square決済リンク
};

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

export function MfBillingList({ month, dueDate, rows, squareConfigured }: { month: string; dueDate: string; rows: MfBillingRow[]; squareConfigured: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const linkNeeded = rows.filter((r) => !r.paymentLink || r.paymentLink.amountInclTax !== r.totalInclTax).length;

  function makeLinks() {
    startTransition(async () => {
      const res = await ensureRoyaltyPaymentLinks(month);
      if (res.error) { setResult(`エラー: ${res.error}`); return; }
      const parts = [`作成 ${res.created}`, `作り直し ${res.updated}`, `変更なし ${res.skipped}`];
      setResult(parts.join("・") + (res.errors.length ? `／失敗 ${res.errors.length}: ${res.errors.join(" / ")}` : ""));
      router.refresh();
    });
  }
  const [y, m] = month.split("-");
  const title = `${y}年${parseInt(m, 10)}月分 ロイヤリティ`;

  const csv = useMemo(() => {
    const header = ["取引先", "代表者", "件名", "自社請求売上(税抜)", "本部請求売上(税抜)", "ロイヤリティ(税抜)", "本部控除済み(税抜)", "請求額(税抜)", "消費税", "請求額(税込)", "支払期限", "カード決済URL", "備考"];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [r.name, r.ownerName, title, r.selfRevenueExclTax, r.hqRevenueExclTax, r.royaltyExclTax, r.commissionExclTax, r.shortfallExclTax, r.taxAmount, r.totalInclTax, dueDate, r.paymentLink && r.paymentLink.amountInclTax === r.totalInclTax ? r.paymentLink.url : "", r.branchNote].map(esc).join(","));
    return [header.map(esc).join(","), ...lines].join("\r\n");
  }, [rows, title, dueDate]);

  const totalInclTax = rows.reduce((s, r) => s + r.totalInclTax, 0);

  async function copy() {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("コピーできませんでした");
    }
  }
  function download() {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `royalty_mf_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-zinc-800">MF入力用一覧 — {title}（支払期限 {dueDate}）</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">請求書はMFクラウド請求で発行。ここは金額の正本。自社請求分の売上に対するロイヤリティを請求し、本部請求分はクライアント入金時に控除済み</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{rows.length}社・税込合計 <span className="font-bold text-zinc-800">¥{fmt(totalInclTax)}</span></span>
          {squareConfigured ? (
            <button onClick={makeLinks} disabled={isPending || rows.length === 0} title="請求1本ごとにSquare決済リンクを作る（金額が変わった分は作り直し）" className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
              決済リンク{linkNeeded > 0 ? `を作成（${linkNeeded}件）` : "は最新"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700" title="SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID を環境変数に設定すると使えます"><AlertTriangle className="w-3 h-3" />Square未設定</span>
          )}
          <button onClick={copy} disabled={rows.length === 0} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 disabled:opacity-50">
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}CSVをコピー
          </button>
          <button onClick={download} disabled={rows.length === 0} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-700 disabled:opacity-50">
            <Download className="w-3 h-3" />CSV
          </button>
        </div>
      </div>
      {result && <p className="px-4 py-2 text-[11px] text-zinc-600 bg-zinc-50 border-b border-zinc-100">{result}</p>}
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-zinc-400">この月に請求が必要な社はありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <th className="px-3 py-2 text-left font-semibold">取引先</th>
                <th className="px-3 py-2 text-right font-semibold">自社請求 売上</th>
                <th className="px-3 py-2 text-right font-semibold">本部請求 売上</th>
                <th className="px-3 py-2 text-right font-semibold">ロイヤリティ</th>
                <th className="px-3 py-2 text-right font-semibold">本部控除済み</th>
                <th className="px-3 py-2 text-right font-semibold">請求額(税抜)</th>
                <th className="px-3 py-2 text-right font-semibold">消費税</th>
                <th className="px-3 py-2 text-right font-semibold">請求額(税込)</th>
                <th className="px-3 py-2 text-center font-semibold">カード決済</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-zinc-50/50">
                  <td className="px-3 py-2">
                    <p className="text-zinc-800">{r.name}</p>
                    {r.branchNote && <p className="text-[10px] text-zinc-400">{r.branchNote}</p>}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-700">¥{fmt(r.selfRevenueExclTax)}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">¥{fmt(r.hqRevenueExclTax)}</td>
                  <td className="px-3 py-2 text-right text-zinc-700">¥{fmt(r.royaltyExclTax)}</td>
                  <td className="px-3 py-2 text-right text-zinc-400">−¥{fmt(r.commissionExclTax)}</td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900">¥{fmt(r.shortfallExclTax)}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">¥{fmt(r.taxAmount)}</td>
                  <td className="px-3 py-2 text-right font-bold text-zinc-900">¥{fmt(r.totalInclTax)}</td>
                  <td className="px-3 py-2 text-center">
                    {r.paymentLink ? (
                      r.paymentLink.amountInclTax === r.totalInclTax ? (
                        <a href={r.paymentLink.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline" title={r.paymentLink.url}>
                          <ExternalLink className="w-3 h-3" />リンク
                        </a>
                      ) : (
                        <span className="text-[10px] text-amber-700" title={`リンクは ¥${fmt(r.paymentLink.amountInclTax)} で作成済み。金額が変わったので作り直しが必要`}>金額変更・要再作成</span>
                      )
                    ) : (
                      <span className="text-[10px] text-zinc-300">未作成</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
