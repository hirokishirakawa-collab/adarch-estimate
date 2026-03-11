"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Users } from "lucide-react";
import { PROPOSAL_INDUSTRY_OPTIONS } from "@/lib/constants/proposals";

interface Customer {
  id: string;
  name: string;
  industry: string | null;
  contactName: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
}

interface ProposalFormProps {
  onGenerated: () => void;
}

export function ProposalForm({ onGenerated }: ProposalFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("restaurant");
  const [challenge, setChallenge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  useEffect(() => {
    fetch("/api/proposals/customers")
      .then((res) => (res.ok ? res.json() : { customers: [] }))
      .then((data) => setCustomers(data.customers ?? []));
  }, []);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) return;

    const c = customers.find((c) => c.id === customerId);
    if (!c) return;

    setCompanyName(c.name);

    // 業種マッチ
    if (c.industry) {
      const match = PROPOSAL_INDUSTRY_OPTIONS.find(
        (opt) =>
          opt.label.includes(c.industry!) || c.industry!.includes(opt.label)
      );
      if (match) setIndustry(match.value);
    }

    // メモがあれば課題欄にプリセット
    if (c.notes) {
      setChallenge(c.notes);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !challenge.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          industry,
          challenge: challenge.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "生成に失敗しました");
        return;
      }
      setCompanyName("");
      setChallenge("");
      setSelectedCustomerId("");
      onGenerated();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <p className="text-sm font-semibold text-zinc-800">提案書を生成</p>
      </div>

      {/* 顧客選択 */}
      {customers.length > 0 && (
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            <Users className="w-3 h-3 inline mr-1" />
            顧客データから選択（任意）
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => handleCustomerSelect(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          >
            <option value="">-- 手動入力する --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.industry ? ` (${c.industry})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">提案先企業名 *</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="例: 株式会社ABC"
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">業種 *</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
          >
            {PROPOSAL_INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-1">課題・ニーズ *</label>
        <textarea
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
          placeholder="例: Web広告は実施しているが動画制作のノウハウがなく、ブランディング動画を制作したい"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
          required
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !companyName.trim() || !challenge.trim()}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            生成中（30秒ほどお待ちください）...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            提案書を生成
          </>
        )}
      </button>
    </form>
  );
}
