"use client";

import { useState } from "react";

const BUSINESS_TYPES = [
  "飲食店（カフェ・レストラン）", "美容室・サロン", "クリニック・歯科",
  "エステ・リラクゼーション", "フィットネス・ジム", "学習塾・スクール",
  "不動産・住宅", "小売店・雑貨", "ブライダル・イベント", "その他",
];

interface ClientData {
  id: string;
  name: string;
  businessType: string;
  area: string;
  target: string;
  sellingPoints: string | null;
  snsAccounts: string | null;
  brandColors: string | null;
  monthlyBudget: number | null;
  postsPerMonth: number;
  status: string;
  notes: string | null;
}

export function ClientEditForm({ client }: { client: ClientData }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch(`/api/studio/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        postsPerMonth: parseInt(data.postsPerMonth as string) || 12,
        monthlyBudget: data.monthlyBudget ? parseInt(data.monthlyBudget as string) : null,
      }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert("保存に失敗しました");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-4">
      <h2 className="font-bold text-zinc-900">クライアント情報</h2>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">店舗名</label>
        <input name="name" defaultValue={client.name} required className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">業種</label>
        <select name="businessType" defaultValue={client.businessType} className="w-full border rounded-lg px-3 py-2 text-sm">
          {BUSINESS_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">エリア</label>
        <input name="area" defaultValue={client.area} required className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">ターゲット</label>
        <input name="target" defaultValue={client.target} required className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">強み・売り</label>
        <textarea name="sellingPoints" defaultValue={client.sellingPoints || ""} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">SNSアカウント</label>
        <input name="snsAccounts" defaultValue={client.snsAccounts || ""} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">月間投稿数</label>
          <select name="postsPerMonth" defaultValue={client.postsPerMonth} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="8">8本</option>
            <option value="12">12本</option>
            <option value="16">16本</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">ステータス</label>
          <select name="status" defaultValue={client.status} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="ACTIVE">運用中</option>
            <option value="PAUSED">一時停止</option>
            <option value="CHURNED">解約</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">メモ</label>
        <textarea name="notes" defaultValue={client.notes || ""} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-zinc-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition disabled:opacity-50"
      >
        {saving ? "保存中..." : saved ? "✓ 保存しました" : "更新"}
      </button>
    </form>
  );
}
