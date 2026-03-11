"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { UnlockGate } from "@/components/proposals/unlock-gate";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { ProposalList } from "@/components/proposals/proposal-list";
import { DEFAULT_UNLOCK_THRESHOLD } from "@/lib/constants/proposals";

interface ProposalData {
  id: string;
  companyName: string;
  industry: string;
  challenge: string;
  content: any;
  createdAt: string;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_UNLOCK_THRESHOLD);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [newThreshold, setNewThreshold] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [actRes, propRes, settingsRes] = await Promise.all([
        fetch("/api/sales-activities"),
        fetch("/api/proposals"),
        fetch("/api/proposals/settings"),
      ]);
      if (actRes.ok) {
        const data = await actRes.json();
        setMonthCount(data.monthCount);
      }
      if (propRes.ok) {
        const data = await propRes.json();
        setProposals(data.proposals);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setThreshold(data.threshold);
        setNewThreshold(String(data.threshold));
        setIsAdmin(data.isAdmin === true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveThreshold = async () => {
    const val = parseInt(newThreshold, 10);
    if (isNaN(val) || val < 1) return;
    const res = await fetch("/api/proposals/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: val }),
    });
    if (res.ok) {
      setThreshold(val);
      setShowSettings(false);
    }
  };

  const isUnlocked = monthCount >= threshold;

  if (loading) {
    return (
      <div className="px-6 py-6 max-w-screen-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-100 rounded w-48" />
          <div className="h-32 bg-zinc-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">提案書AI</h2>
            <p className="text-xs text-zinc-500">
              企業情報を入力してAIが提案書を自動生成
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              title="閾値設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <Link
            href="/dashboard/sales-activities"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> アクティビティへ
          </Link>
        </div>
      </div>

      {/* Admin settings */}
      {showSettings && isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800 mb-2">アンロック閾値設定（管理者）</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700">月間</span>
              <input
                type="number"
                min={1}
                max={100}
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                className="w-20 px-2 py-1 text-sm border border-amber-300 rounded-lg text-center"
              />
              <span className="text-xs text-amber-700">件以上で解放</span>
              <button
                onClick={handleSaveThreshold}
                className="ml-2 px-3 py-1 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <UnlockGate monthCount={monthCount} threshold={threshold} />

      {isUnlocked ? (
        <>
          <ProposalForm onGenerated={fetchData} />
          <ProposalList proposals={proposals} />
        </>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
          <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 mb-2">
            今月あと <span className="font-bold text-blue-600">{threshold - monthCount}件</span> のアクティビティを記録すると利用できます
          </p>
          <Link
            href="/dashboard/sales-activities"
            className="text-xs text-blue-600 hover:underline"
          >
            アクティビティを記録する →
          </Link>
        </div>
      )}
    </div>
  );
}
