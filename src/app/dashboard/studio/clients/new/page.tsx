"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, LinkIcon, X } from "lucide-react";
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

type Customer = {
  id: string;
  name: string;
  industry: string | null;
  prefecture: string | null;
  address: string | null;
};

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Customer linking
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);

  // Form autofill from customer
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [area, setArea] = useState("");

  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 1) { setCustomers([]); return; }
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : data.customers || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch) searchCustomers(customerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  function selectCustomer(c: Customer) {
    setLinkedCustomer(c);
    setShowResults(false);
    setCustomerSearch("");
    // Autofill
    if (!name) setName(c.name);
    if (!area && (c.prefecture || c.address)) setArea([c.prefecture, c.address].filter(Boolean).join(" "));
    // Map industry to business type
    if (!businessType && c.industry) {
      const map: Record<string, string> = {
        "飲食": "飲食店（カフェ・レストラン）",
        "美容": "美容室・サロン",
        "医療": "クリニック・歯科",
        "エステ": "エステ・リラクゼーション",
        "フィットネス": "フィットネス・ジム",
        "教育": "学習塾・スクール",
        "不動産": "不動産・住宅",
        "小売": "小売店・雑貨",
        "ブライダル": "ブライダル・イベント",
      };
      for (const [key, val] of Object.entries(map)) {
        if (c.industry.includes(key)) { setBusinessType(val); break; }
      }
    }
  }

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
        name,
        businessType,
        area,
        postsPerMonth: parseInt(data.postsPerMonth as string) || 12,
        monthlyBudget: data.monthlyBudget ? parseInt(data.monthlyBudget as string) : null,
        customerId: linkedCustomer?.id || null,
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer linking */}
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-indigo-900">既存顧客と紐づけ（任意）</h2>
          </div>
          <p className="text-xs text-indigo-600 mb-3">
            顧客管理（CRM）に登録済みの顧客を紐づけると、名前・業種・エリアが自動入力されます。
          </p>

          {linkedCustomer ? (
            <div className="flex items-center justify-between bg-white rounded-lg border border-indigo-200 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-zinc-900">{linkedCustomer.name}</div>
                <div className="text-xs text-zinc-500">
                  {[linkedCustomer.industry, linkedCustomer.prefecture, linkedCustomer.address].filter(Boolean).join(" / ")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkedCustomer(null)}
                className="text-zinc-400 hover:text-zinc-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                placeholder="顧客名で検索..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {showResults && customers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition border-b border-zinc-100 last:border-0"
                    >
                      <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                      <div className="text-xs text-zinc-500">
                        {[c.industry, c.prefecture, c.address].filter(Boolean).join(" / ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showResults && customerSearch && customers.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-20 px-4 py-3 text-xs text-zinc-400">
                  該当する顧客が見つかりません。紐づけなしで登録できます。
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main form */}
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">店舗名・企業名 *</label>
              <input
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="例: Hair Salon BLOOM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">業種 *</label>
              <select
                name="businessType"
                required
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">エリア *</label>
              <input
                name="area"
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="例: 横浜市青葉区"
              />
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
              <select name="postsPerMonth" defaultValue="12" className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="8">8本</option>
                <option value="12">12本</option>
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

          {linkedCustomer && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
              <LinkIcon className="w-3 h-3" />
              顧客管理「{linkedCustomer.name}」と紐づけて登録されます
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-fuchsia-600 text-white py-3 rounded-lg font-medium hover:bg-fuchsia-700 transition disabled:opacity-50"
          >
            {saving ? "保存中..." : "クライアントを登録"}
          </button>
        </div>
      </form>
    </div>
  );
}
