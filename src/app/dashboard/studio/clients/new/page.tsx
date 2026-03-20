"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const BUSINESS_TYPES = [
  "飲食店（カフェ・レストラン）",
  "美容室・サロン",
  "クリニック・歯科",
  "エステ・リラクゼーション",
  "フィットネス・ジム",
  "学習塾・スクール",
  "不動産・住宅",
  "小売店・雑貨",
  "ブライダル・イベント",
  "その他",
];

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch("/api/studio/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        postsPerMonth: parseInt(data.postsPerMonth as string) || 12,
        monthlyBudget: data.monthlyBudget ? parseInt(data.monthlyBudget as string) : null,
      }),
    });

    if (res.ok) {
      const client = await res.json();
      router.push(`/dashboard/studio/clients/${client.id}`);
    } else {
      alert("保存に失敗しました");
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/dashboard/studio/clients" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        クライアント一覧に戻る
      </Link>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">新規クライアント登録</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">店舗名・企業名 *</label>
            <input name="name" required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: Hair Salon BLOOM" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">業種 *</label>
            <select name="businessType" required className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">選択してください</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">エリア *</label>
            <input name="area" required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 横浜市青葉区" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">ターゲット *</label>
            <input name="target" required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 20-40代女性" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">強み・売りポイント *</label>
          <textarea name="sellingPoints" required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: オーガニック素材使用、キッズスペースあり、駅徒歩3分" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">SNSアカウント</label>
            <input name="snsAccounts" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: @hairsalon_bloom" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">月額予算（円）</label>
            <input name="monthlyBudget" type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: 100000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">月間投稿数</label>
            <select name="postsPerMonth" className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="8">8本</option>
              <option value="12" selected>12本</option>
              <option value="16">16本</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">ブランドカラー</label>
            <input name="brandColors" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例: #FF6B6B, #4ECDC4" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">メモ</label>
          <textarea name="notes" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="自由メモ" />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-fuchsia-600 text-white py-3 rounded-lg font-medium hover:bg-fuchsia-700 transition disabled:opacity-50"
        >
          {saving ? "保存中..." : "クライアントを登録"}
        </button>
      </form>
    </div>
  );
}
