"use client";

import { SCORE_ITEMS, getPriorityLabel } from "@/lib/constants/leads";
import type { ScoredLead, WebsiteAnalysis, BusinessType, SuccessProfileInfo } from "@/lib/constants/leads";
import {
  MapPin,
  Phone,
  Star,
  ExternalLink,
  Globe,
  Plus,
  Check,
  Loader2,
  Video,
  VideoOff,
  Share2,
  Monitor,
  Users,
  Building2,
  Store,
  Landmark,
  GitBranch,
  Sparkles,
  MessageSquareQuote,
  MapPinned,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BUSINESS_TYPE_CONFIG: Record<
  BusinessType,
  { label: string; icon: React.ReactNode; className: string; advice: string }
> = {
  independent: {
    label: "独立企業",
    icon: <Building2 className="w-3.5 h-3.5" />,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    advice: "オーナーへ直接提案が可能。意思決定が早い傾向",
  },
  chain: {
    label: "チェーン店",
    icon: <Store className="w-3.5 h-3.5" />,
    className: "bg-purple-50 text-purple-700 border-purple-200",
    advice: "本部決裁の可能性あり。エリア限定施策の提案が有効",
  },
  franchise: {
    label: "フランチャイズ",
    icon: <Landmark className="w-3.5 h-3.5" />,
    className: "bg-blue-50 text-blue-700 border-blue-200",
    advice: "FC本部 or 加盟店オーナーどちらが決裁者か確認が必要",
  },
  branch: {
    label: "支店・店舗",
    icon: <GitBranch className="w-3.5 h-3.5" />,
    className: "bg-orange-50 text-orange-700 border-orange-200",
    advice: "本社への紹介依頼 or 支店独自予算の確認が有効",
  },
  unknown: {
    label: "判定中",
    icon: <Building2 className="w-3.5 h-3.5" />,
    className: "bg-zinc-50 text-zinc-600 border-zinc-200",
    advice: "",
  },
};

interface LeadDetailPanelProps {
  lead: ScoredLead;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  successProfile?: SuccessProfileInfo | null;
}

// 企業タイプ（チェーン/独立/FC/支店）を文章で表示
function BusinessTypeSection({ analysis }: { analysis: WebsiteAnalysis }) {
  const config = BUSINESS_TYPE_CONFIG[analysis.businessType];

  return (
    <div className={`rounded-lg border px-4 py-3 ${config.className}`}>
      <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
        {config.icon}
        企業タイプ
      </p>
      <p className="text-sm font-medium mb-1">
        この企業は「{config.label}」の可能性が高いです
      </p>
      {config.advice && (
        <p className="text-sm">{config.advice}</p>
      )}
      <p className="text-xs opacity-70 mt-1.5">
        判定理由: {analysis.businessTypeReason}
      </p>
    </div>
  );
}

// デジタル活用度の各項目を「活用中」「提案チャンス」に分類して表示
function DigitalAnalysisCard({ analysis }: { analysis: WebsiteAnalysis }) {
  if (!analysis.hasWebsite) {
    return (
      <div className="bg-amber-50 rounded-lg border border-amber-200 px-4 py-3">
        <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1.5">
          <Monitor className="w-3.5 h-3.5" />
          デジタル活用度
        </p>
        <p className="text-sm text-amber-800 font-medium mb-1">
          Webサイトなし — デジタル全般の提案チャンス
        </p>
        <p className="text-xs text-amber-600">
          Web制作・映像制作・SNS運用をまとめて提案できる可能性があります
        </p>
      </div>
    );
  }

  type Finding = {
    icon: React.ReactNode;
    label: string;
    type: "using" | "chance";
    detail: string;
  };

  const findings: Finding[] = [];

  // 動画
  if (analysis.hasYouTube) {
    findings.push({
      icon: <Video className="w-3.5 h-3.5" />,
      label: "YouTube活用中",
      type: "using",
      detail: "動画の品質向上・追加コンテンツ制作を提案",
    });
  } else if (analysis.hasVideo) {
    findings.push({
      icon: <Video className="w-3.5 h-3.5" />,
      label: "動画あり（YouTube以外）",
      type: "using",
      detail: "YouTube展開・動画リニューアルを提案",
    });
  } else {
    findings.push({
      icon: <VideoOff className="w-3.5 h-3.5" />,
      label: "動画未活用",
      type: "chance",
      detail: "映像制作・YouTube運用の提案チャンス大",
    });
  }

  // SNS
  if (analysis.hasSns.length > 0) {
    findings.push({
      icon: <Share2 className="w-3.5 h-3.5" />,
      label: `SNS活用中（${analysis.hasSns.join(", ")}）`,
      type: "using",
      detail: "SNS広告・ショート動画制作を提案",
    });
  } else {
    findings.push({
      icon: <Share2 className="w-3.5 h-3.5" />,
      label: "SNS未活用",
      type: "chance",
      detail: "SNS運用代行・ショート動画の提案チャンス",
    });
  }

  // サイトの新しさ
  if (analysis.siteAge === "outdated") {
    findings.push({
      icon: <Monitor className="w-3.5 h-3.5" />,
      label: "サイトが古め",
      type: "chance",
      detail: "Webリニューアル＋動画LPの提案が有効",
    });
  }

  // 採用ページ
  if (analysis.hasRecruitPage) {
    findings.push({
      icon: <Users className="w-3.5 h-3.5" />,
      label: "採用ページあり",
      type: "chance",
      detail: "採用動画・会社紹介動画の提案が有力",
    });
  }

  const chances = findings.filter((f) => f.type === "chance");
  const using = findings.filter((f) => f.type === "using");

  return (
    <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
      <p className="text-xs font-medium text-zinc-500 mb-3 flex items-center gap-1.5">
        <Monitor className="w-3.5 h-3.5" />
        デジタル活用度
      </p>

      {chances.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-medium text-amber-600 mb-1.5">
            提案チャンス
          </p>
          <div className="space-y-1.5">
            {chances.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 flex-shrink-0">
                  {f.icon}
                  {f.label}
                </span>
                <span className="text-xs text-zinc-500 pt-0.5">{f.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {using.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-emerald-600 mb-1.5">
            活用中
          </p>
          <div className="space-y-1.5">
            {using.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 flex-shrink-0">
                  {f.icon}
                  {f.label}
                </span>
                <span className="text-xs text-zinc-500 pt-0.5">{f.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LeadDetailPanel({
  lead,
  isSaved,
  isSaving,
  onSave,
  successProfile,
}: LeadDetailPanelProps) {
  const priority = getPriorityLabel(lead.score.total);

  return (
    <div className="bg-zinc-50 border-t border-zinc-200 px-5 py-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-zinc-700">
            <MapPin className="w-4 h-4 mt-0.5 text-zinc-400 flex-shrink-0" />
            <span>{lead.address || "住所情報なし"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-700">
            <Phone className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <span>{lead.phone || "電話番号なし"}</span>
          </div>
          {lead.rating > 0 && (
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                {lead.rating.toFixed(1)} ({lead.ratingCount}件のレビュー)
              </span>
            </div>
          )}
          {lead.mapsUrl && (
            <a
              href={lead.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Google Maps で開く
            </a>
          )}
          {lead.websiteUrl && (
            <a
              href={lead.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <Globe className="w-3.5 h-3.5" />
              Webサイトを開く
            </a>
          )}
        </div>

        {/* スコア内訳 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            スコア内訳
            {successProfile && (
              <span className="ml-2 text-purple-500 normal-case tracking-normal font-normal">
                ▲ = 成功企業の平均
              </span>
            )}
          </p>
          {SCORE_ITEMS.map((item) => {
            const val = lead.score.breakdown[item.key] ?? 0;
            const pct = (val / item.max) * 100;
            const successAvg = successProfile?.avgBreakdown?.[item.key];
            const successPct = successAvg ? (successAvg / item.max) * 100 : null;
            return (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-xs text-zinc-600 w-28 flex-shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.key === "digitalPresence"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  {successPct !== null && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-purple-500"
                      style={{ left: `${Math.min(successPct, 100)}%`, marginLeft: "-4px" }}
                      title={`成功平均: ${successAvg?.toFixed(1)}`}
                    />
                  )}
                </div>
                <span className="text-xs text-zinc-500 w-12 text-right">
                  {val}/{item.max}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Google AIインサイト */}
      {(lead.reviewSummary || lead.placeSummary || lead.neighborhoodSummary || lead.isFutureOpening) && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 px-4 py-3">
          <p className="text-xs font-medium text-blue-700 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Google AIインサイト
          </p>
          <div className="space-y-2.5">
            {lead.isFutureOpening && (
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700 border border-green-200 flex-shrink-0">
                  🆕 近日開業予定
                </span>
                <span className="text-xs text-green-700 pt-0.5">開業前の広告提案は最大のチャンス。競合より先にアプローチ可能</span>
              </div>
            )}
            {lead.reviewSummary && (
              <div className="flex items-start gap-2">
                <MessageSquareQuote className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-blue-600 mb-0.5">レビュー要約</p>
                  <p className="text-xs text-zinc-700 leading-relaxed">{lead.reviewSummary}</p>
                </div>
              </div>
            )}
            {lead.placeSummary && (
              <div className="flex items-start gap-2">
                <Building2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-blue-600 mb-0.5">Google概要</p>
                  <p className="text-xs text-zinc-700 leading-relaxed">{lead.placeSummary}</p>
                </div>
              </div>
            )}
            {lead.neighborhoodSummary && (
              <div className="flex items-start gap-2">
                <MapPinned className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-medium text-blue-600 mb-0.5">周辺エリア</p>
                  <p className="text-xs text-zinc-700 leading-relaxed">{lead.neighborhoodSummary}</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-blue-400 mt-2">Summarized with Google Gemini</p>
        </div>
      )}

      {/* 企業タイプ + デジタル活用度 */}
      {lead.digitalAnalysis && (
        <>
          {lead.digitalAnalysis.businessType !== "unknown" && (
            <BusinessTypeSection analysis={lead.digitalAnalysis} />
          )}
          <DigitalAnalysisCard analysis={lead.digitalAnalysis} />
        </>
      )}

      {/* AIコメント */}
      <div className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
        <p className="text-xs font-medium text-zinc-500 mb-1">AIコメント</p>
        <p className="text-sm text-zinc-700">{lead.score.comment}</p>
      </div>

      {/* アクション */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${priority.className}`}
        >
          {priority.emoji} {priority.label}（{lead.score.total}点）
        </span>
        <Button
          size="sm"
          variant={isSaved ? "outline" : "default"}
          onClick={onSave}
          disabled={isSaved || isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isSaved ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {isSaving ? "保存中..." : isSaved ? "保存済み" : "営業リストへ保存"}
        </Button>
      </div>
    </div>
  );
}
