"use client";

import { useState, useTransition } from "react";
import {
  ExternalLink,
  Film,
  MapPin,
  Building2,
  Loader2,
  CheckCircle2,
  HandMetal,
  AlertCircle,
  Youtube,
  FileText,
  Newspaper,
  Globe,
} from "lucide-react";
import { claimTvcmLead } from "@/lib/actions/lead";
import {
  detectTvcmSourcePlatform,
  TVCM_SOURCE_LABEL,
  type TvcmSourcePlatform,
} from "@/lib/constants/tvcm-leads";

const SOURCE_VISUAL: Record<
  TvcmSourcePlatform,
  { icon: typeof Youtube; bg: string; text: string }
> = {
  youtube: { icon: Youtube, bg: "bg-red-50", text: "text-red-700" },
  prtimes: { icon: FileText, bg: "bg-blue-50", text: "text-blue-700" },
  atpress: { icon: Newspaper, bg: "bg-amber-50", text: "text-amber-700" },
  unknown: { icon: Globe, bg: "bg-zinc-50", text: "text-zinc-600" },
};

export interface TvcmPoolLead {
  id: string;
  name: string;
  address: string | null;
  prefecture: string | null;
  industry: string | null;
  pressReleaseUrl: string | null;
  pressReleaseTitle: string | null;
  videoUrl: string | null;
  productionCompany: string | null;
  announcedDate: Date | null;
  websiteUrl: string | null;
  scoreComment: string | null;
  capital: bigint | null;
  employeeCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  lead: TvcmPoolLead;
  claimable: boolean; // true = 未claim（claim可能）、false = 自分がclaim済み
}

export function TvcmPoolCard({ lead, claimable }: Props) {
  const [isPending, startTransition] = useTransition();
  const [resultMsg, setResultMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [claimed, setClaimed] = useState(!claimable);

  const handleClaim = () => {
    if (!confirm(`${lead.name} の案件を担当します。よろしいですか？\n（claimすると他のパートナーは取れなくなります）`)) {
      return;
    }
    startTransition(async () => {
      const res = await claimTvcmLead(lead.id);
      if (res.success) {
        setClaimed(true);
        setResultMsg({ kind: "ok", text: `あなたの案件になりました` });
      } else {
        setResultMsg({ kind: "err", text: res.error ?? "claim失敗" });
      }
    });
  };

  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        claimed ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="text-sm font-semibold text-zinc-900 truncate">
            {lead.name}
          </span>
          {(() => {
            const platform = detectTvcmSourcePlatform(lead.pressReleaseUrl);
            const visual = SOURCE_VISUAL[platform];
            const Icon = visual.icon;
            return (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${visual.bg} ${visual.text} px-1.5 py-0.5 rounded shrink-0`}
                title="情報元"
              >
                <Icon className="w-2.5 h-2.5" />
                {TVCM_SOURCE_LABEL[platform]}
              </span>
            );
          })()}
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
              lead.prefecture
                ? "text-emerald-700 bg-emerald-50"
                : "text-zinc-500 bg-zinc-100"
            }`}
          >
            <MapPin className="w-2.5 h-2.5" />
            {lead.prefecture || "都道府県不明"}
          </span>
          {lead.industry && (
            <span className="text-[10px] font-medium text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">
              {lead.industry}
            </span>
          )}
          {claimed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
              <CheckCircle2 className="w-2.5 h-2.5" />
              あなたの案件
            </span>
          )}
        </div>
      </div>

      {lead.scoreComment && (
        <p className="text-xs text-zinc-700 mb-2 leading-relaxed">
          {lead.scoreComment}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap mb-2">
        {lead.address && <span>📍 {lead.address}</span>}
        {lead.productionCompany && <span>🎬 制作: {lead.productionCompany}</span>}
        {lead.employeeCount && <span>👥 {lead.employeeCount}名</span>}
        {lead.capital !== null && (
          <span>💴 {Math.round(Number(lead.capital) / 10000).toLocaleString()}万円</span>
        )}
        <span>📅 {new Date(lead.createdAt).toLocaleDateString("ja-JP")}投入</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {lead.videoUrl && (
            <a
              href={lead.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:underline"
            >
              <Film className="w-3 h-3" />
              動画を見る
            </a>
          )}
          {lead.pressReleaseUrl && (
            <a
              href={lead.pressReleaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              PR記事
            </a>
          )}
          {lead.websiteUrl && (
            <a
              href={lead.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              企業サイト
            </a>
          )}
        </div>

        {!claimed && (
          <button
            onClick={handleClaim}
            disabled={isPending}
            className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                claim中...
              </>
            ) : (
              <>
                <HandMetal className="w-3.5 h-3.5" />
                私がやります
              </>
            )}
          </button>
        )}
      </div>

      {resultMsg && (
        <div
          className={`mt-2 text-[11px] flex items-center gap-1 ${
            resultMsg.kind === "ok" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {resultMsg.kind === "ok" ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <AlertCircle className="w-3 h-3" />
          )}
          {resultMsg.text}
        </div>
      )}
    </div>
  );
}
