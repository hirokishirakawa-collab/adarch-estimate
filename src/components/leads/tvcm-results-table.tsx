"use client";

import {
  ExternalLink,
  Plus,
  Check,
  Loader2,
  Building2,
  Film,
  MapPin,
  X,
  AlertTriangle,
  Inbox,
  PhoneCall,
  Calendar,
  Trophy,
  XCircle,
  Database,
  User,
  Youtube,
  FileText,
  Newspaper,
  Globe,
} from "lucide-react";
import { useState } from "react";
import {
  detectTvcmSourcePlatform,
  TVCM_SOURCE_LABEL,
  type TvcmLeadCandidate,
  type TvcmLeadResult,
  type TvcmSourcePlatform,
} from "@/lib/constants/tvcm-leads";
import type { LeadRejectReasonValue } from "@/lib/constants/leads";
import { RejectReasonPicker } from "./reject-reason-picker";

const SOURCE_VISUAL: Record<
  TvcmSourcePlatform,
  { icon: typeof Youtube; bg: string; text: string }
> = {
  youtube: { icon: Youtube, bg: "bg-red-50", text: "text-red-700" },
  prtimes: { icon: FileText, bg: "bg-blue-50", text: "text-blue-700" },
  atpress: { icon: Newspaper, bg: "bg-amber-50", text: "text-amber-700" },
  unknown: { icon: Globe, bg: "bg-zinc-50", text: "text-zinc-600" },
};

interface Props {
  candidates: TvcmLeadResult[]; // 警告情報・現在のDB状態を含む全候補
  decidedMap: Map<string, "pool" | "reject">; // companyName → 決定（このセッション中の操作）
  decidingName: string | null;
  onPool: (c: TvcmLeadCandidate) => void;
  onReject: (c: TvcmLeadCandidate, reason: LeadRejectReasonValue) => void;
  onPoolAll: () => void;
}

function StatusBadge({
  status,
  assigneeName,
}: {
  status?: TvcmLeadResult["currentStatus"];
  assigneeName?: string | null;
}) {
  if (!status) return null;
  const config: Record<
    NonNullable<TvcmLeadResult["currentStatus"]>,
    { label: string; bg: string; text: string; icon: typeof Inbox }
  > = {
    CRAWLED: { label: "クロール済", bg: "bg-zinc-100", text: "text-zinc-700", icon: Database },
    UNTOUCHED: { label: "プール中", bg: "bg-blue-50", text: "text-blue-700", icon: Inbox },
    CALLED: { label: "架電済", bg: "bg-violet-50", text: "text-violet-700", icon: PhoneCall },
    APPOINTMENT: { label: "アポ獲得", bg: "bg-amber-50", text: "text-amber-700", icon: Calendar },
    DEAL_CONVERTED: { label: "受注済", bg: "bg-emerald-50", text: "text-emerald-700", icon: Trophy },
    SKIPPED: { label: "却下済", bg: "bg-red-50", text: "text-red-700", icon: XCircle },
    ARCHIVED: { label: "アーカイブ", bg: "bg-zinc-100", text: "text-zinc-500", icon: Database },
  };
  const c = config[status];
  if (!c) return null;
  const Icon = c.icon;
  const showAssignee = assigneeName && (status === "UNTOUCHED" || status === "CALLED" || status === "APPOINTMENT" || status === "DEAL_CONVERTED");
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium ${c.bg} ${c.text} border border-current/20 px-1.5 py-0.5 rounded`}
    >
      <Icon className="w-2.5 h-2.5" />
      {c.label}
      {showAssignee && (
        <>
          <User className="w-2.5 h-2.5 ml-0.5" />
          {assigneeName}
        </>
      )}
    </span>
  );
}

export function TvcmResultsTable({
  candidates,
  decidedMap,
  decidingName,
  onPool,
  onReject,
  onPoolAll,
}: Props) {
  // 却下理由の選択中の企業名（1件ずつしか開かない）
  const [reasonOpenFor, setReasonOpenFor] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center">
        <p className="text-sm text-zinc-500">
          条件に合致する動画コンテンツ発表企業が見つかりませんでした。
        </p>
      </div>
    );
  }

  const undecidedCount = candidates.filter((c) => !decidedMap.has(c.companyName)).length;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
        <div className="text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">{candidates.length}件</span> の候補（未判定 {undecidedCount}件）
        </div>
        <button
          onClick={onPoolAll}
          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          disabled={decidingName !== null || undecidedCount === 0}
        >
          <Plus className="w-3 h-3" />
          未判定を全てプール投入
        </button>
      </div>

      <div className="divide-y divide-zinc-100">
        {candidates.map((c) => {
          const decision = decidedMap.get(c.companyName);
          const deciding = decidingName === c.companyName;

          return (
            <div
              key={c.pressReleaseUrl}
              className={`px-5 py-4 hover:bg-zinc-50 ${
                decision === "reject" ? "bg-zinc-50/60 opacity-60" : ""
              } ${decision === "pool" ? "bg-emerald-50/40" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* ヘッダー: 会社名 + バッジ */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-sm font-semibold text-zinc-900">
                      {c.companyName}
                    </span>
                    {(() => {
                      const platform = detectTvcmSourcePlatform(c.pressReleaseUrl);
                      const visual = SOURCE_VISUAL[platform];
                      const Icon = visual.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${visual.bg} ${visual.text} px-1.5 py-0.5 rounded`}
                          title="情報元"
                        >
                          <Icon className="w-2.5 h-2.5" />
                          {TVCM_SOURCE_LABEL[platform]}
                        </span>
                      );
                    })()}
                    <StatusBadge status={c.currentStatus} assigneeName={c.currentAssigneeName} />
                    {c.prefecture && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <MapPin className="w-2.5 h-2.5" />
                        {c.prefecture}
                      </span>
                    )}
                    {c.industryGuess && (
                      <span className="text-[10px] font-medium text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                        {c.industryGuess}
                      </span>
                    )}
                    {/* 警告（大手代理店/上場企業） */}
                    {c.exclusionReason && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {c.exclusionReason}
                      </span>
                    )}
                  </div>

                  {/* AIサマリー */}
                  {c.summary && (
                    <p className="text-xs text-zinc-700 mt-1.5 leading-relaxed">
                      {c.summary}
                    </p>
                  )}

                  {/* メタ情報 */}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500 flex-wrap">
                    {c.address && <span>📍 {c.address}</span>}
                    {c.productionCompany && (
                      <span>🎬 制作: {c.productionCompany}</span>
                    )}
                    {c.employeeCount && (
                      <span>👥 {c.employeeCount}名</span>
                    )}
                    {c.capital && (
                      <span>💴 資本金 {Math.round(c.capital / 10000).toLocaleString()}万円</span>
                    )}
                  </div>

                  {/* リンク */}
                  <div className="flex items-center gap-3 mt-2">
                    {c.videoUrl && (
                      <a
                        href={c.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:underline"
                      >
                        <Film className="w-3 h-3" />
                        動画を見る
                      </a>
                    )}
                    <a
                      href={c.pressReleaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      ソースを開く
                    </a>
                    {c.companyWebsite && (
                      <a
                        href={c.companyWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        企業サイト
                      </a>
                    )}
                  </div>
                </div>

                {/* アクションボタン（プール / 却下） */}
                <div className="shrink-0 flex flex-col gap-1.5">
                  {decision === "pool" ? (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      プール投入済
                    </span>
                  ) : decision === "reject" ? (
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      <X className="w-3 h-3" />
                      却下済
                    </span>
                  ) : reasonOpenFor === c.companyName ? (
                    <RejectReasonPicker
                      disabled={deciding}
                      onPick={(reason) => {
                        setReasonOpenFor(null);
                        onReject(c, reason);
                      }}
                      onCancel={() => setReasonOpenFor(null)}
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => onPool(c)}
                        disabled={deciding}
                        className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                      >
                        {deciding ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            プールへ
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setReasonOpenFor(c.companyName)}
                        disabled={deciding}
                        className="text-xs font-medium text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        却下
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
