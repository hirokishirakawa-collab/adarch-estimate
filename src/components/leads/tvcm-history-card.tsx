"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  MapPin,
  ExternalLink,
  Film,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Database,
  Inbox,
  PhoneCall,
  Calendar,
  Trophy,
  XCircle,
  User,
} from "lucide-react";
import { transitionTvcmLeadStatus } from "@/lib/actions/lead";

type Status = "CRAWLED" | "UNTOUCHED" | "CALLED" | "APPOINTMENT" | "DEAL_CONVERTED" | "SKIPPED";

export interface TvcmHistoryLead {
  id: string;
  name: string;
  address: string | null;
  prefecture: string | null;
  industry: string | null;
  status: Status;
  pressReleaseUrl: string | null;
  videoUrl: string | null;
  productionCompany: string | null;
  announcedDate: Date | null;
  websiteUrl: string | null;
  scoreComment: string | null;
  agencyDetected: string | null;
  isListed: boolean | null;
  capital: bigint | null;
  employeeCount: number | null;
  createdAt: Date;
  assigneeName: string | null;
}

const STATUS_CONFIG: Record<
  Status,
  { label: string; bg: string; text: string; icon: typeof Inbox }
> = {
  CRAWLED: { label: "クロール済（未判定）", bg: "bg-zinc-100", text: "text-zinc-700", icon: Database },
  UNTOUCHED: { label: "プール中", bg: "bg-blue-50", text: "text-blue-700", icon: Inbox },
  CALLED: { label: "架電済", bg: "bg-violet-50", text: "text-violet-700", icon: PhoneCall },
  APPOINTMENT: { label: "アポ獲得", bg: "bg-amber-50", text: "text-amber-700", icon: Calendar },
  DEAL_CONVERTED: { label: "受注済", bg: "bg-emerald-50", text: "text-emerald-700", icon: Trophy },
  SKIPPED: { label: "却下済", bg: "bg-red-50", text: "text-red-700", icon: XCircle },
};

export function TvcmHistoryCard({ lead }: { lead: TvcmHistoryLead }) {
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState<Status>(lead.status);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const handleDecide = (decision: "pool" | "reject") => {
    const verb = decision === "pool" ? "プール投入" : "却下";
    if (!confirm(`${lead.name} を ${verb} にします。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await transitionTvcmLeadStatus(lead.id, decision);
      if (res.success) {
        setCurrentStatus(decision === "pool" ? "UNTOUCHED" : "SKIPPED");
        setResultMsg(`${verb}しました`);
      } else {
        setResultMsg(res.error ?? "失敗");
      }
    });
  };

  const sc = STATUS_CONFIG[currentStatus];
  const StatusIcon = sc.icon;
  const canDecide = currentStatus === "CRAWLED";

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-sm font-semibold text-zinc-900">{lead.name}</span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium ${sc.bg} ${sc.text} border border-current/20 px-1.5 py-0.5 rounded`}
            >
              <StatusIcon className="w-2.5 h-2.5" />
              {sc.label}
              {lead.assigneeName && (
                <>
                  <User className="w-2.5 h-2.5 ml-0.5" />
                  {lead.assigneeName}
                </>
              )}
            </span>
            {lead.prefecture && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                <MapPin className="w-2.5 h-2.5" />
                {lead.prefecture}
              </span>
            )}
            {lead.industry && (
              <span className="text-[10px] font-medium text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                {lead.industry}
              </span>
            )}
            {lead.agencyDetected && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                ⚠️ {lead.agencyDetected}
              </span>
            )}
            {lead.isListed && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                ⚠️ 上場
              </span>
            )}
          </div>

          {lead.scoreComment && (
            <p className="text-xs text-zinc-700 mb-1.5 leading-relaxed">
              {lead.scoreComment}
            </p>
          )}

          <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
            {lead.address && <span>📍 {lead.address}</span>}
            {lead.productionCompany && <span>🎬 {lead.productionCompany}</span>}
            {lead.employeeCount && <span>👥 {lead.employeeCount}名</span>}
            {lead.capital !== null && (
              <span>💴 {Math.round(Number(lead.capital) / 10000).toLocaleString()}万円</span>
            )}
            <span>📅 {new Date(lead.createdAt).toLocaleDateString("ja-JP")}</span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            {lead.videoUrl && (
              <a
                href={lead.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:underline"
              >
                <Film className="w-3 h-3" />
                動画
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
                ソース
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
        </div>

        {/* 決定ボタン (CRAWLED の場合のみ表示) */}
        {canDecide && (
          <div className="shrink-0 flex flex-col gap-1.5">
            <button
              onClick={() => handleDecide("pool")}
              disabled={isPending}
              className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              プールへ
            </button>
            <button
              onClick={() => handleDecide("reject")}
              disabled={isPending}
              className="text-xs font-medium text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-50 px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              却下
            </button>
          </div>
        )}
      </div>
      {resultMsg && (
        <div className="mt-2 text-[11px] flex items-center gap-1 text-emerald-700">
          <CheckCircle2 className="w-3 h-3" />
          {resultMsg}
        </div>
      )}
    </div>
  );
}
