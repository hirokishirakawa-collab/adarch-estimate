"use client";

// TVer配信実績 — CSV取込フォーム（本部）。取込後は詳細へ

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importDeliveryCsv } from "@/lib/actions/tver-delivery";

export function ImportForm({ companies }: { companies: { id: string; name: string; prefecture: string | null }[] }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <details className="bg-white border border-zinc-200 rounded-xl" open>
      <summary className="cursor-pointer px-5 py-3.5 text-sm font-bold text-zinc-800 flex items-center gap-2">
        <Upload className="w-4 h-4 text-orange-600" />
        配信レポートCSVを取り込む
      </summary>
      <form
        ref={ref}
        className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await importDeliveryCsv(fd);
            if (r.error) {
              setMsg(`⚠️ ${r.error}`);
              return;
            }
            setMsg(r.message ?? "取り込みました");
            ref.current?.reset();
            if (r.id) router.push(`/dashboard/admin/tver-reports/${r.id}`);
            else router.refresh();
          });
        }}
      >
        <label className="text-xs text-zinc-600 sm:col-span-3">
          CSVファイル <span className="text-red-500">*</span>（TVer管理画面 → レポート作成 → 配信レポート → ダウンロード。1広告主ずつ。同じ広告主で期間が重なる既存レポートがあれば、その日付の行を差し替えて最新にします）
          <input type="file" name="file" accept=".csv,text/csv" required className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        </label>
        <label className="text-xs text-zinc-600">
          公開先の拠点（後から変更可・同じ広告主の前回の紐づけを自動で引き継ぎ）
          <select name="groupCompanyId" defaultValue="" className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
            <option value="">未選択（後で選ぶ）</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.prefecture ? `（${c.prefecture}）` : ""}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-600 sm:col-span-2">
          本部メモ（内部）
          <input name="adminNote" maxLength={2000} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" placeholder="例: 7/20〜8/19 月次分" />
        </label>
        <div className="sm:col-span-3 flex items-center gap-3">
          <button disabled={pending} className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium disabled:opacity-50">{pending ? "取り込み中…" : "取り込む"}</button>
          {msg && <span className="text-sm text-zinc-700">{msg}</span>}
        </div>
      </form>
    </details>
  );
}
