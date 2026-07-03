"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FranchiseLeadCard } from "./franchise-lead-card";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
export interface FranchiseLeadData {
  id: string;
  companyName: string;
  address: string;
  prefecture: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  googleMapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessType: string | null;
  scoreTotal: number | null;
  scoreBreakdown: Record<string, number> | null;
  scoreComment: string | null;
  aiAdvice: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  emailDraftedAt: string | null;
  hasWebsite: boolean;
  hasYoutube: boolean;
  hasSns: boolean;
  employeeEstimate: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  contactedAt: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  source: string;
  revenueRange: string | null;
  createdAt: string;
  updatedAt: string;
}

// SLA判定（/api/cron/franchise-sla と同一ルール）。対象はインバウンドリードのみ。
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function evaluateSla(lead: FranchiseLeadData, now: number): string | null {
  if (lead.source === "OUTBOUND") return null;
  const age = now - new Date(lead.createdAt).getTime();
  const sinceContact =
    now - new Date(lead.contactedAt ?? lead.updatedAt).getTime();
  const sinceUpdate = now - new Date(lead.updatedAt).getTime();

  switch (lead.status) {
    case "NEW":
      return age >= 24 * HOUR ? "🔴 24時間以内の初回返信が未了" : null;
    case "CONTACTED":
      if (sinceContact >= 4 * DAY) return "🔴 4日経過 — 電話フェーズへ";
      if (sinceContact >= 3 * DAY) return "🟡 3日経過 — リマインド送付期限";
      return null;
    case "INTERESTED":
      return sinceUpdate >= 4 * DAY ? "🔴 4日更新なし — 電話フェーズへ" : null;
    case "MEETING_DONE":
      return sinceUpdate >= 48 * HOUR
        ? "🔴 面談後48時間 — クロージング期限超過"
        : null;
    default:
      return null;
  }
}

// パイプラインのステージ定義
const PIPELINE_STAGES = [
  { key: "NEW", label: "新規", color: "bg-zinc-100 border-zinc-300 text-zinc-700" },
  { key: "CONTACTED", label: "連絡済み", color: "bg-blue-50 border-blue-300 text-blue-700" },
  { key: "INTERESTED", label: "興味あり", color: "bg-purple-50 border-purple-300 text-purple-700" },
  { key: "MEETING_SCHEDULED", label: "面談予定", color: "bg-amber-50 border-amber-300 text-amber-700" },
  { key: "MEETING_DONE", label: "面談済み", color: "bg-orange-50 border-orange-300 text-orange-700" },
  { key: "NEGOTIATING", label: "交渉中", color: "bg-teal-50 border-teal-300 text-teal-700" },
  { key: "CONTRACTED", label: "加盟契約", color: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { key: "REJECTED", label: "辞退", color: "bg-red-50 border-red-300 text-red-700" },
  { key: "NOT_FIT", label: "対象外", color: "bg-zinc-50 border-zinc-200 text-zinc-500" },
];

const ACTIVE_STAGES = PIPELINE_STAGES.filter(
  (s) => !["REJECTED", "NOT_FIT", "CONTRACTED"].includes(s.key)
);

const CLOSED_STAGES = PIPELINE_STAGES.filter(
  (s) => ["CONTRACTED", "REJECTED", "NOT_FIT"].includes(s.key)
);

// ----------------------------------------------------------------
// コンポーネント
// ----------------------------------------------------------------
export function FranchisePipeline() {
  const [leads, setLeads] = useState<FranchiseLeadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/franchise-leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<FranchiseLeadData>) => {
      const res = await fetch("/api/franchise-leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      if (res.ok) {
        const data = await res.json();
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l))
        );
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch("/api/franchise-leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== id));
      }
    },
    []
  );

  // CSV書き出し（画面に読み込み済み＝アクセス権限内のリードのみ出力）
  const handleExportCsv = useCallback(() => {
    if (leads.length === 0) return;
    const stageLabel = (key: string) =>
      PIPELINE_STAGES.find((s) => s.key === key)?.label ?? key;
    const esc = (v: unknown) => {
      let s = v === null || v === undefined ? "" : String(v);
      // CSVフォーミュラインジェクション対策: 数式起点文字で始まる値は先頭に ' を付けて無害化
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmtDate = (s: string | null) =>
      s ? new Date(s).toLocaleDateString("ja-JP") : "";
    const header = [
      "会社名", "都道府県", "住所", "電話", "メール", "Webサイト", "業種",
      "スコア", "優先度", "ステータス", "次アクション", "次アクション予定日",
      "メモ", "担当者", "登録日",
    ];
    const rows = leads.map((l) => [
      l.companyName, l.prefecture, l.address, l.phone, l.email, l.website,
      l.businessType, l.scoreTotal, l.priority, stageLabel(l.status),
      l.nextAction, fmtDate(l.nextActionDate), l.notes, l.ownerName,
      fmtDate(l.createdAt),
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `加盟リード_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [leads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        <span className="ml-2 text-sm text-zinc-500">読み込み中...</span>
      </div>
    );
  }

  const getStageLeads = (stageKey: string) =>
    leads.filter((l) => l.status === stageKey);

  const totalActive = ACTIVE_STAGES.reduce(
    (sum, s) => sum + getStageLeads(s.key).length,
    0
  );
  const totalClosed = CLOSED_STAGES.reduce(
    (sum, s) => sum + getStageLeads(s.key).length,
    0
  );

  const now = Date.now();
  const slaViolations = leads
    .map((l) => ({ lead: l, sla: evaluateSla(l, now) }))
    .filter((v): v is { lead: FranchiseLeadData; sla: string } => v.sla !== null);

  return (
    <div className="space-y-5">
      {/* SLA超過アラート（インバウンドリード） */}
      {slaViolations.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-red-700 mb-2">
            ⏰ SLA超過 {slaViolations.length}件 — 今すぐ対応
          </p>
          <div className="space-y-1">
            {slaViolations.map(({ lead, sla }) => (
              <p key={lead.id} className="text-xs text-red-800">
                <span className="font-semibold">{lead.companyName}</span>
                <span className="text-red-500">
                  （{lead.prefecture ?? "県不明"}
                  {lead.revenueRange ? ` / ${lead.revenueRange}` : ""}）
                </span>
                {" — "}
                {sla}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* サマリー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-zinc-600">
            アクティブ: <span className="font-bold">{totalActive}</span>件 /
            クローズ: <span className="font-bold">{totalClosed}</span>件
          </p>
          <Button size="xs" variant="outline" onClick={() => setShowClosed(!showClosed)} className="gap-1">
            {showClosed ? "クローズを非表示" : "クローズを表示"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={handleExportCsv}
            disabled={leads.length === 0}
            className="gap-1"
          >
            <Download className="w-3 h-3" />
            CSV書き出し
          </Button>
          <Button size="xs" variant="outline" onClick={fetchLeads} className="gap-1">
            <RefreshCw className="w-3 h-3" />
            更新
          </Button>
        </div>
      </div>

      {/* パイプライン（カンバン） */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {ACTIVE_STAGES.map((stage) => {
            const stageLeads = getStageLeads(stage.key);
            return (
              <div
                key={stage.key}
                className={`w-72 flex-shrink-0 rounded-xl border-2 ${stage.color} p-3`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold">{stage.label}</h3>
                  <span className="text-xs font-medium opacity-70">{stageLeads.length}</span>
                </div>
                <div className="space-y-2 min-h-[4rem]">
                  {stageLeads.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 text-center py-4">
                      リードなし
                    </p>
                  ) : (
                    stageLeads.map((lead) => (
                      <FranchiseLeadCard
                        key={lead.id}
                        lead={lead}
                        stages={PIPELINE_STAGES}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* クローズ済み */}
      {showClosed && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-zinc-500">クローズ済み</p>
          <div className="flex gap-3 overflow-x-auto pb-2 min-w-max">
            {CLOSED_STAGES.map((stage) => {
              const stageLeads = getStageLeads(stage.key);
              return (
                <div
                  key={stage.key}
                  className={`w-72 flex-shrink-0 rounded-xl border-2 ${stage.color} p-3 opacity-75`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold">{stage.label}</h3>
                    <span className="text-xs font-medium opacity-70">{stageLeads.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[2rem]">
                    {stageLeads.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 text-center py-2">なし</p>
                    ) : (
                      stageLeads.map((lead) => (
                        <FranchiseLeadCard
                          key={lead.id}
                          lead={lead}
                          stages={PIPELINE_STAGES}
                          onUpdate={handleUpdate}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {leads.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-zinc-500">
            {"\u307E\u3060\u52A0\u76DF\u30EA\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002Search\u30BF\u30D6\u3067\u5019\u88DC\u3092\u691C\u7D22\u3057\u3066\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}
          </p>
        </div>
      )}
    </div>
  );
}
