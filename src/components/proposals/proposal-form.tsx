"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Users, ClipboardList } from "lucide-react";
import { PROPOSAL_INDUSTRY_OPTIONS } from "@/lib/constants/proposals";

interface HearingSheet {
  id: string;
  businessDescription: string | null;
  targetCustomers: string[];
  tradeArea: string | null;
  annualRevenue: string | null;
  employeeCount: string | null;
  currentChannels: string[];
  monthlyAdBudget: string | null;
  pastEfforts: string | null;
  competitors: string | null;
  primaryChallenge: string | null;
  challengeDetail: string | null;
  interestedServices: string[];
  desiredTimeline: string | null;
  decisionMaker: string | null;
  budgetStatus: string | null;
  videoPurposes: string[];
  videoBudget: string | null;
  temperature: string | null;
}

interface Customer {
  id: string;
  name: string;
  industry: string | null;
  contactName: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  hearingSheets: HearingSheet[];
}

interface ProposalFormProps {
  onGenerated: () => void;
}

/** ヒアリングシートから課題テキストを生成 */
function buildChallengeFromHearing(h: HearingSheet): string {
  const parts: string[] = [];

  if (h.primaryChallenge) parts.push(`課題: ${h.primaryChallenge}`);
  if (h.challengeDetail) parts.push(h.challengeDetail);
  if (h.interestedServices.length > 0)
    parts.push(`興味のあるサービス: ${h.interestedServices.join("、")}`);
  if (h.pastEfforts) parts.push(`過去の施策: ${h.pastEfforts}`);
  if (h.videoPurposes.length > 0)
    parts.push(`動画の用途: ${h.videoPurposes.join("、")}`);

  return parts.join("\n");
}

/** ヒアリングシートのサマリーを表示用に生成 */
function buildHearingSummary(h: HearingSheet): string[] {
  const items: string[] = [];
  if (h.businessDescription) items.push(`事業: ${h.businessDescription}`);
  if (h.targetCustomers.length > 0) items.push(`ターゲット: ${h.targetCustomers.join("、")}`);
  if (h.annualRevenue) items.push(`年商: ${h.annualRevenue}`);
  if (h.employeeCount) items.push(`従業員: ${h.employeeCount}`);
  if (h.currentChannels.length > 0) items.push(`集客手段: ${h.currentChannels.join("、")}`);
  if (h.monthlyAdBudget) items.push(`広告費: ${h.monthlyAdBudget}`);
  if (h.primaryChallenge) items.push(`課題: ${h.primaryChallenge}`);
  if (h.temperature) items.push(`温度感: ${h.temperature}`);
  if (h.budgetStatus) items.push(`予算: ${h.budgetStatus}`);
  return items;
}

export function ProposalForm({ onGenerated }: ProposalFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("restaurant");
  const [challenge, setChallenge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [activeHearing, setActiveHearing] = useState<HearingSheet | null>(null);

  useEffect(() => {
    fetch("/api/proposals/customers")
      .then((res) => (res.ok ? res.json() : { customers: [] }))
      .then((data) => setCustomers(data.customers ?? []));
  }, []);

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveHearing(null);
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

    // ヒアリングシートがあれば課題を自動生成
    const hearing = c.hearingSheets?.[0];
    if (hearing) {
      setActiveHearing(hearing);
      const challengeText = buildChallengeFromHearing(hearing);
      if (challengeText) setChallenge(challengeText);
    } else if (c.notes) {
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
          hearingSheetId: activeHearing?.id || undefined,
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
      setActiveHearing(null);
      onGenerated();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const hearingSummary = activeHearing ? buildHearingSummary(activeHearing) : [];

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
                {c.name}{c.industry ? ` (${c.industry})` : ""}{c.hearingSheets?.length > 0 ? " [HS]" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ヒアリングシート情報表示 */}
      {activeHearing && hearingSummary.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs font-semibold text-blue-800">ヒアリングシート反映中</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {hearingSummary.map((item, i) => (
              <p key={i} className="text-[11px] text-blue-700">{item}</p>
            ))}
          </div>
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
