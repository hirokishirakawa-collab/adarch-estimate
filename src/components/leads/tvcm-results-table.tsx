"use client";

import { ExternalLink, Plus, Check, Loader2, Building2, Film, MapPin } from "lucide-react";
import type { TvcmLeadCandidate } from "@/lib/constants/tvcm-leads";

interface Props {
  candidates: TvcmLeadCandidate[];
  savedNames: Set<string>;
  savingName: string | null;
  existingMap: Record<string, string>;
  onSave: (c: TvcmLeadCandidate) => void;
  onSaveAll: () => void;
}

export function TvcmResultsTable({
  candidates,
  savedNames,
  savingName,
  existingMap,
  onSave,
  onSaveAll,
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

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
        <div className="text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">{candidates.length}件</span> の営業候補（フィルタ通過）
        </div>
        <button
          onClick={onSaveAll}
          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          disabled={savingName !== null}
        >
          <Plus className="w-3 h-3" />
          すべてリードに保存
        </button>
      </div>

      <div className="divide-y divide-zinc-100">
        {candidates.map((c) => {
          const saved = savedNames.has(c.companyName);
          const saving = savingName === c.companyName;
          const existingTag = existingMap[`${c.companyName}|${c.address ?? ""}`];

          return (
            <div key={c.pressReleaseUrl} className="px-5 py-4 hover:bg-zinc-50">
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
                      プレスリリース
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

                {/* 保存ボタン */}
                <div className="shrink-0">
                  <button
                    onClick={() => onSave(c)}
                    disabled={saved || saving}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 ${
                      saved
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                        : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    {saving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : saved ? (
                      <>
                        <Check className="w-3 h-3" />
                        保存済
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        リード化
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
