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
} from "lucide-react";
import type { TvcmLeadCandidate, TvcmLeadResult } from "@/lib/constants/tvcm-leads";

interface Props {
  candidates: TvcmLeadResult[]; // 警告情報を含む全候補
  decidedMap: Map<string, "pool" | "reject">; // companyName → 決定
  decidingName: string | null;
  existingMap: Record<string, string>;
  onPool: (c: TvcmLeadCandidate) => void;
  onReject: (c: TvcmLeadCandidate) => void;
  onPoolAll: () => void;
}

export function TvcmResultsTable({
  candidates,
  decidedMap,
  decidingName,
  existingMap,
  onPool,
  onReject,
  onPoolAll,
}: Props) {
  if (candidates.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center">
        <p className="text-sm text-zinc-500">
          条件に合致するTVCM/動画PR発表企業が見つかりませんでした。
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
          const existingTag = existingMap[`${c.companyName}|${c.address ?? ""}`];

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
                    {existingTag && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        ⚠️ {existingTag}
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
                        onClick={() => onReject(c)}
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
