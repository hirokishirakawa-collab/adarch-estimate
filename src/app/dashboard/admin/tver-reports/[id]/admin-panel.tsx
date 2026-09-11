"use client";

// TVer配信実績 — 本部の操作パネル（紐づけ・メモ・確認完了＝公開・公開取消）

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishDeliveryReport, unpublishDeliveryReport, updateDeliveryReport } from "@/lib/actions/tver-delivery";

export function ReportAdminPanel(p: {
  id: string; status: "IMPORTED" | "PUBLISHED"; groupCompanyId: string; tverOrderId: string; adminNote: string; partnerNote: string;
  companies: { id: string; name: string; prefecture: string | null }[];
  orders: { id: string; label: string; hit: boolean }[];
  hasWarnings: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [company, setCompany] = useState(p.groupCompanyId);
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? `⚠️ ${r.error}` : r.message ?? "保存しました");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="bg-white border border-zinc-200 rounded-xl p-5 text-sm">
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">公開先の紐づけ</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => updateDeliveryReport(p.id, fd));
          }}
        >
          <label className="block text-xs text-zinc-600">
            拠点（この拠点の画面に出ます） <span className="text-red-500">*</span>
            <select name="groupCompanyId" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="">未選択</option>
              {p.companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.prefecture ? `（${c.prefecture}）` : ""}</option>)}
            </select>
          </label>
          <label className="block text-xs text-zinc-600">
            TVer小口申込（あれば・広告主名が近いものを先頭に）
            <select name="tverOrderId" defaultValue={p.tverOrderId} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="">紐づけない</option>
              {p.orders.map((o) => <option key={o.id} value={o.id}>{o.hit ? "★ " : ""}{o.label}</option>)}
            </select>
          </label>
          <label className="block text-xs text-zinc-600">
            拠点に見せる一言（任意・実績ページの上に出ます）
            <textarea name="partnerNote" defaultValue={p.partnerNote} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="例: 7/20〜8/19分。福岡が最も伸びています" />
          </label>
          <label className="block text-xs text-zinc-600">
            本部メモ（内部）
            <textarea name="adminNote" defaultValue={p.adminNote} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <button disabled={pending} className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm disabled:opacity-50">保存</button>
        </form>
      </section>

      <section className={`border rounded-xl p-5 text-sm ${p.status === "PUBLISHED" ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}`}>
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">{p.status === "PUBLISHED" ? "公開済み" : "確認完了＝拠点に公開"}</h2>
        <p className="text-xs text-zinc-600 mb-3">
          {p.status === "PUBLISHED"
            ? "紐づけた拠点の「TVer配信実績」に売価だけが出ています。取り消すと拠点から見えなくなります。"
            : `左の金額（売価＝卸値×3）と裏計算のずれを見て問題なければ押してください。${p.hasWarnings ? "警告があります。内容を確認してから公開してください。" : ""}${!company ? "拠点が未選択のため公開できません。" : ""}`}
        </p>
        {p.status === "PUBLISHED" ? (
          <button
            disabled={pending}
            className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-800 text-sm disabled:opacity-50"
            onClick={() => {
              if (!confirm("公開を取り消しますか？拠点から見えなくなります。")) return;
              run(() => unpublishDeliveryReport(p.id));
            }}
          >
            公開を取り消す
          </button>
        ) : (
          <button
            disabled={pending || !company}
            className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
            onClick={() => {
              if (!confirm("確認完了として拠点に公開します。よろしいですか？（紐づけを変えた場合は先に「保存」してください）")) return;
              run(() => publishDeliveryReport(p.id));
            }}
          >
            確認完了＝公開する
          </button>
        )}
        {msg && <p className="mt-3 text-sm text-zinc-800">{msg}</p>}
      </section>
    </div>
  );
}
