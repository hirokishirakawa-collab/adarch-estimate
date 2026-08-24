"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Phone, Mail, ArrowRightLeft, Pencil, Check, X, Sparkles, Loader2, ChevronDown, ChevronUp, ClipboardList, FileSpreadsheet, FileText, Film, Globe, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_OPTIONS, getLeadStatusOption, getPriorityLabel, getLeadSourceOption } from "@/lib/constants/leads";
import { updateLeadStatus, updateLeadMemo, assignLead, convertLeadToCustomer, deleteSelectedLeads, bulkUpdateLeadStatus, bulkAssignLeads } from "@/lib/actions/lead";
import { findEmailsForLeads } from "@/lib/actions/lead-email";
import { getFreshness, SIGNAL_KIND_LABEL, type SignalKind } from "@/lib/leads/signal";
import { getHearingSheet } from "@/lib/actions/hearing";
import { OutreachResultBar } from "./outreach-result-bar";
import { daysSince } from "@/lib/constants/outreach-result";
import { HearingSheetForm } from "./hearing-sheet-form";
import { Trash2, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeadRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** メール取得を試した時刻。値があって email が null なら「探したが記載なし」 */
  emailCheckedAt: string | Date | null;
  rating: number;
  ratingCount: number;
  types: string[];
  businessStatus: string | null;
  scoreTotal: number;
  scoreComment: string | null;
  scoreBreakdown: Record<string, number> | null;
  source: string | null;
  status: string;
  memo: string | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  videoUrl: string | null;
  pressReleaseUrl: string | null;
  industry: string | null;
  area: string | null;
  youtubeChannelUrl: string | null;
  youtubeSubscribers: number | null;
  assignee: { id: string; name: string | null; email: string } | null;
  convertedCustomer: { id: string; name: string } | null;
  releasedFromName: string | null;
  signalAt: string | Date | null;
  signalKind: string | null;
  /** 営業フォームで送付済みにした日。値があれば結果ボタンを出す */
  sentAt: string | Date | null;
  /** 送った先から返ってきた結果。null = 返事待ち */
  outreachResult: string | null;
  createdAt: string | Date;
}

/** シグナル鮮度の帯ごとの見た目。新しいほど強い色にして、上から当たる順が目で分かるようにする */
const FRESHNESS_CLASS: Record<string, string> = {
  hot:  "bg-rose-50 text-rose-700 border-rose-200",
  warm: "bg-amber-50 text-amber-700 border-amber-200",
  cool: "bg-zinc-50 text-zinc-500 border-zinc-200",
  cold: "bg-transparent text-zinc-300 border-transparent",
};

/** 登録日を YYYY/MM/DD 形式で表示 */
function formatRegisteredDate(value: string | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

/** href に使う前にスキームを http/https に限定（javascript: 等のXSS対策） */
function safeHttpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// 現在のステータスから「次に進める」ワンタップ候補。
// ドロップダウンは戻し用に残しつつ、日々一番多い前進操作を1タップに。
const QUICK_ADVANCE: Record<string, { to: string; label: string; cls: string }[]> = {
  UNTOUCHED: [
    { to: "CALLED", label: "📞 連絡済", cls: "bg-blue-600 text-white hover:bg-blue-700 border-blue-600" },
  ],
  CALLED: [
    { to: "APPOINTMENT", label: "📅 アポ", cls: "bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500" },
    { to: "DEAL_CONVERTED", label: "🎉 商談化", cls: "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600" },
  ],
  APPOINTMENT: [
    { to: "DEAL_CONVERTED", label: "🎉 商談化", cls: "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600" },
  ],
};

interface Props {
  leads: LeadRow[];
  users: Array<{ id: string; name: string | null; email: string }>;
  isAdmin?: boolean;
  canSelect?: boolean;
}

export function LeadListTable({ leads, users, isAdmin, canSelect }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, startDeleting] = useTransition();
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [findingEmails, setFindingEmails] = useState(false);

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      const params = new URLSearchParams();
      params.set("format", format);

      if (selectedIds.size > 0) {
        // 選択ありなら選択分のみ
        params.set("ids", Array.from(selectedIds).join(","));
      } else {
        // 選択なしならフィルター条件で全件
        const q = searchParams.get("q");
        const status = searchParams.get("status");
        const industry = searchParams.get("industry");
        const area = searchParams.get("area");
        if (q) params.set("q", q);
        if (status) params.set("status", status);
        if (industry) params.set("industry", industry);
        if (area) params.set("area", area);
      }

      const res = await fetch(`/api/leads/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `leads.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("エクスポートに失敗しました");
    } finally {
      setExporting(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択した${selectedIds.size}件のリードを削除しますか？`)) return;
    startDeleting(async () => {
      const result = await deleteSelectedLeads(Array.from(selectedIds));
      if (result.error) {
        alert(result.error);
      } else {
        setSelectedIds(new Set());
      }
    });
  };

  const handleBulkStatusChange = (newStatus: string) => {
    const ids = Array.from(selectedIds);
    startDeleting(async () => {
      const result = await bulkUpdateLeadStatus(ids, newStatus);
      if (result.error) {
        alert(result.error);
      } else {
        setSelectedIds(new Set());
      }
    });
  };

  /**
   * 選択した会社のサイトを見に行き、記載されているメールアドレスを取り込む。
   * ついでに「営業お断り」も判定し、見つかった会社は全社の送付禁止リストに載せる。
   */
  const handleFindEmails = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setFindingEmails(true);
    (async () => {
      try {
        const r = await findEmailsForLeads(ids);
        if (r.error) { alert(r.error); return; }

        const lines = [
          `${r.checked}社のサイトを確認しました。`,
          "",
          `✅ メールが見つかった: ${r.found}社`,
          `⛔ 営業お断り（送付禁止リストに登録）: ${r.blocked}社`,
          `— サイトに記載なし: ${r.notFound}社`,
          `— サイトを開けず: ${r.unreachable}社`,
        ];
        if (r.skipped) lines.push(`— 対象外（サイト未登録・取得済み）: ${r.skipped}社`);
        if (r.remaining) lines.push("", `⚠️ 残り${r.remaining}社は上限のため未処理です。もう一度実行してください。`);
        alert(lines.join("\n"));
        router.refresh();
      } finally {
        setFindingEmails(false);
      }
    })();
  };

  const handleBulkAssign = (assigneeId: string) => {
    const ids = Array.from(selectedIds);
    startDeleting(async () => {
      const result = await bulkAssignLeads(ids, assigneeId || null);
      if (result.error) {
        alert(result.error);
      } else {
        setSelectedIds(new Set());
      }
    });
  };

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 text-center">
        <p className="text-sm text-zinc-400">リードが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* 操作アイコン凡例 + エクスポート */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <ClipboardList className="w-3 h-3 text-amber-500" /> ヒアリング
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <Sparkles className="w-3 h-3 text-purple-500" /> AI営業提案
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <ExternalLink className="w-3 h-3 text-blue-500" /> Map確認
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <ArrowRightLeft className="w-3 h-3 text-emerald-500" /> 顧客に転換
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting === "csv" ? "出力中..." : "CSV"}
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            {exporting === "pdf" ? "出力中..." : "PDF"}
          </button>
        </div>
      </div>

      {/* 選択操作バー */}
      {canSelect && selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-sm font-medium text-blue-700">
            {selectedIds.size}件選択中
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
            >
              選択解除
            </button>
          </p>
          <div className="flex items-center gap-2">
            {/* メール一括取得（相手サイトから拾う。推測はしない） */}
            <button
              onClick={handleFindEmails}
              disabled={isDeleting || findingEmails}
              title="選択した会社のサイトを見に行き、記載されているメールアドレスを取り込みます"
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {findingEmails ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              メールを取得
            </button>

            {/* ステータス一括変更 */}
            <div className="flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <select
                disabled={isDeleting}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusChange(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 cursor-pointer"
              >
                <option value="">ステータス変更...</option>
                {LEAD_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 担当者一括変更 */}
            <div className="flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              <select
                disabled={isDeleting}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value !== "") {
                    handleBulkAssign(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 cursor-pointer"
              >
                <option value="">担当者変更...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* 営業フォームへ（選択した会社を営業フォームに投入） */}
            <button
              onClick={() =>
                router.push(`/dashboard/leads/outreach?ids=${Array.from(selectedIds).join(",")}`)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1F3A5F] rounded-lg hover:bg-[#16304f] transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              営業フォームへ
            </button>

            {/* メール送付（メールアドレス取得済みの選択リードだけをアウトリーチに投入） */}
            {(() => {
              const emailIds = leads
                .filter((l) => selectedIds.has(l.id) && l.email)
                .map((l) => l.id);
              return (
                <button
                  onClick={() =>
                    router.push(`/dashboard/leads/outreach?ids=${emailIds.join(",")}`)
                  }
                  disabled={emailIds.length === 0}
                  title={
                    emailIds.length === 0
                      ? "選択中にメールアドレス取得済みの会社がありません。先に「メールを取得」を押してください"
                      : "メールアドレス取得済みの会社をアウトリーチ画面に送ります。件名・本文入りのメール下書きをそのまま開けます"
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  メール送付：アウトリーチへ（{emailIds.length}件）
                </button>
              );
            })()}

            {/* エクスポート */}
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {exporting === "csv" ? "出力中..." : "CSV"}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {exporting === "pdf" ? "出力中..." : "PDF"}
            </button>

            {/* 一括削除（ADMIN のみ） */}
            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="gap-1.5"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                削除
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {canSelect && (
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === leads.length && leads.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300"
                  />
                </th>
              )}
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">
                会社名
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-24">
                獲得元
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-16">
                スコア
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-24">
                シグナル
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-28">
                ステータス
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-32">
                担当者
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-44 hidden md:table-cell">
                連絡先
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-24 hidden lg:table-cell">
                登録日
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 min-w-[160px]">
                メモ
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-20">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                users={users}
                isAdmin={isAdmin}
                canSelect={canSelect}
                selected={selectedIds.has(lead.id)}
                onToggleSelect={() => toggleSelect(lead.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeadRow({
  lead,
  users,
  isAdmin,
  canSelect,
  selected,
  onToggleSelect,
}: {
  lead: LeadRow;
  users: Array<{ id: string; name: string | null; email: string }>;
  isAdmin?: boolean;
  canSelect?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoValue, setMemoValue] = useState(lead.memo ?? "");
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [hearingOpen, setHearingOpen] = useState(false);
  const [hearingData, setHearingData] = useState<Awaited<ReturnType<typeof getHearingSheet>> | undefined>(undefined);
  const [hearingLoading, setHearingLoading] = useState(false);

  const statusOpt = getLeadStatusOption(lead.status);
  const priority = getPriorityLabel(lead.scoreTotal);
  const freshness = getFreshness(lead.signalAt);
  const signalLabel =
    SIGNAL_KIND_LABEL[(lead.signalKind ?? "FOUND") as SignalKind] ?? "発掘";

  const handleAdvice = async () => {
    if (advice) {
      setAdviceOpen(!adviceOpen);
      return;
    }
    setAdviceLoading(true);
    setAdviceOpen(true);
    try {
      const res = await fetch("/api/leads/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          address: lead.address,
          phone: lead.phone,
          industry: lead.industry,
          area: lead.area,
          rating: lead.rating,
          ratingCount: lead.ratingCount,
          types: lead.types,
          businessStatus: lead.businessStatus,
          scoreTotal: lead.scoreTotal,
          scoreComment: lead.scoreComment,
          scoreBreakdown: lead.scoreBreakdown,
          memo: lead.memo,
          websiteUrl: lead.websiteUrl,
          youtubeChannelUrl: lead.youtubeChannelUrl,
          youtubeSubscribers: lead.youtubeSubscribers,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setAdvice(data.advice);
    } catch {
      setAdvice("提案の生成に失敗しました。もう一度お試しください。");
    } finally {
      setAdviceLoading(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      await updateLeadStatus(lead.id, newStatus);
    });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    if (!assigneeId) return;
    startTransition(async () => {
      await assignLead(lead.id, assigneeId);
    });
  };

  const handleMemoSave = () => {
    startTransition(async () => {
      await updateLeadMemo(lead.id, memoValue);
      setEditingMemo(false);
    });
  };

  const handleConvert = () => {
    if (!confirm(`「${lead.name}」を顧客に転換しますか？`)) return;
    startTransition(async () => {
      const result = await convertLeadToCustomer(lead.id);
      if (result.customerId) {
        router.push(`/dashboard/customers/${result.customerId}`);
      }
    });
  };

  const handleHearing = async () => {
    if (hearingOpen) {
      setHearingOpen(false);
      return;
    }
    if (hearingData === undefined) {
      setHearingLoading(true);
      try {
        const data = await getHearingSheet(lead.id);
        setHearingData(data);
      } catch {
        setHearingData(null);
      } finally {
        setHearingLoading(false);
      }
    }
    setHearingOpen(true);
  };

  return (
    <>
    <tr
      className={cn(
        "border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors",
        isPending && "opacity-50"
      )}
    >
      {/* チェックボックス */}
      {canSelect && (
        <td className="px-3 py-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="rounded border-zinc-300"
          />
        </td>
      )}

      {/* 会社名 */}
      <td className="px-4 py-3">
        <p className="font-medium text-zinc-900 truncate max-w-[200px]">
          {lead.name}
        </p>
        {lead.address && (
          <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">
            {lead.address}
          </p>
        )}
        {/* TVer案件プール由来のURL（動画・PR記事・企業サイト） */}
        {lead.source === "PR_TIMES_TVCM" &&
          (() => {
            const videoUrl = safeHttpUrl(lead.videoUrl);
            const pressReleaseUrl = safeHttpUrl(lead.pressReleaseUrl);
            const websiteUrl = safeHttpUrl(lead.websiteUrl);
            if (!videoUrl && !pressReleaseUrl && !websiteUrl) return null;
            return (
              <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:underline"
                  >
                    <Film className="w-3 h-3" />
                    動画
                  </a>
                )}
                {pressReleaseUrl && (
                  <a
                    href={pressReleaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    PR記事
                  </a>
                )}
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:underline"
                  >
                    <Globe className="w-3 h-3" />
                    企業サイト
                  </a>
                )}
              </div>
            );
          })()}
      </td>

      {/* 獲得元（どのリード獲得AIで取得したか） */}
      <td className="px-3 py-3 text-center">
        {(() => {
          const sourceOpt = getLeadSourceOption(lead.source);
          if (!sourceOpt) return <span className="text-xs text-zinc-300">-</span>;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap",
                sourceOpt.className
              )}
              title={sourceOpt.label}
            >
              {sourceOpt.icon} {sourceOpt.shortLabel}
            </span>
          );
        })()}
      </td>

      {/* スコア（TVer広告プール由来はAIスコア対象外） */}
      <td className="px-3 py-3 text-center">
        {lead.source === "PR_TIMES_TVCM" ? (
          <span
            className="text-[11px] text-zinc-400"
            title="TVer広告 案件プール由来（AIスコアリング対象外）"
          >
            —
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border",
              priority.className
            )}
            title={lead.scoreComment ?? ""}
          >
            {priority.emoji} {lead.scoreTotal}
          </span>
        )}
      </td>

      {/* シグナル鮮度（買う気配が立ってからの日数） */}
      <td className="px-3 py-3 text-center">
        {freshness ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap",
              FRESHNESS_CLASS[freshness.key]
            )}
            title={`${signalLabel}（${freshness.days}日前）`}
          >
            {freshness.icon} {freshness.days}日
          </span>
        ) : (
          <span className="text-[11px] text-zinc-300">—</span>
        )}
      </td>

      {/* ステータス */}
      <td className="px-3 py-3">
        <div className="flex flex-col items-stretch gap-1 min-w-[120px]">
          {/* ワンタップで次へ進める（前進操作） */}
          {(QUICK_ADVANCE[lead.status] ?? []).length > 0 && (
            <div className="flex gap-1">
              {QUICK_ADVANCE[lead.status].map((a) => (
                <button
                  key={a.to}
                  onClick={() => handleStatusChange(a.to)}
                  disabled={isPending}
                  className={cn(
                    "flex-1 text-[11px] font-bold border rounded px-2 py-1 transition-colors disabled:opacity-50 whitespace-nowrap",
                    a.cls
                  )}
                  title={`このリードを「${getLeadStatusOption(a.to).label}」にする`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {/* 戻し・スキップ用ドロップダウン */}
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isPending || lead.status === "DEAL_CONVERTED"}
            className={cn(
              "text-[11px] font-medium border rounded px-1.5 py-0.5 cursor-pointer focus:outline-none text-center",
              statusOpt.className,
              (isPending || lead.status === "DEAL_CONVERTED") && "opacity-60 cursor-not-allowed"
            )}
          >
            {LEAD_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
          {/* 送付済みなら結果を1クリックで。押すとグループ事例にも自動で残る */}
          {lead.sentAt && (
            <div className="pt-1 mt-0.5 border-t border-zinc-100">
              <div className="text-[10px] text-zinc-400 mb-0.5">
                送付から{daysSince(lead.sentAt)}日{lead.outreachResult ? "" : "・結果未入力"}
              </div>
              <OutreachResultBar
                leadId={lead.id}
                result={lead.outreachResult}
                size="compact"
                showLabel={false}
              />
            </div>
          )}
        </div>
      </td>

      {/* 担当者 */}
      <td className="px-3 py-3">
        <select
          value={lead.assignee?.id ?? ""}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          disabled={isPending}
          className="text-xs border border-zinc-200 rounded px-1.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">未アサイン</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
        {!lead.assignee && lead.releasedFromName && (
          <span
            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium"
            title={`過去に ${lead.releasedFromName} さんが担当 → 動きがなく解放されました（現在のステータスで声かけ済みか未着手かが分かります）`}
          >
            過去: {lead.releasedFromName}
          </span>
        )}
      </td>

      {/* 連絡先（電話・メール） */}
      <td className="px-3 py-3 hidden md:table-cell">
        <div className="flex flex-col gap-0.5">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <Phone className="w-3 h-3 shrink-0" />
              {lead.phone}
            </a>
          ) : (
            <span className="text-xs text-zinc-300">-</span>
          )}

          {/* メール: 取得済み / 探したが記載なし / 未取得 の3状態を出し分ける */}
          {lead.email ? (
            <span
              title={lead.email}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-600 max-w-[170px]"
            >
              <Mail className="w-3 h-3 shrink-0 text-zinc-400" />
              <span className="truncate">{lead.email}</span>
            </span>
          ) : lead.emailCheckedAt ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-300">
              <Mail className="w-3 h-3 shrink-0" />
              記載なし
            </span>
          ) : null}
        </div>
      </td>

      {/* 登録日 */}
      <td className="px-3 py-3 hidden lg:table-cell">
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          {formatRegisteredDate(lead.createdAt)}
        </span>
      </td>

      {/* メモ */}
      <td className="px-3 py-3">
        {editingMemo ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={memoValue}
              onChange={(e) => setMemoValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleMemoSave();
                if (e.key === "Escape") setEditingMemo(false);
              }}
              className="text-xs border border-zinc-300 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
            <button
              onClick={handleMemoSave}
              className="text-emerald-600 hover:text-emerald-700"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setEditingMemo(false);
                setMemoValue(lead.memo ?? "");
              }}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 cursor-pointer group"
            onClick={() => setEditingMemo(true)}
          >
            <p className="text-xs text-zinc-500 truncate max-w-[140px]">
              {lead.memo || "メモなし"}
            </p>
            <Pencil className="w-3 h-3 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </td>

      {/* 操作 */}
      <td className="px-3 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={handleHearing}
            disabled={hearingLoading}
            className={cn(
              "p-1 transition-colors",
              hearingOpen ? "text-amber-600" : "text-zinc-400 hover:text-amber-600",
              hearingLoading && "animate-pulse"
            )}
            title="ヒアリングシート"
          >
            {hearingLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ClipboardList className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleAdvice}
            disabled={adviceLoading}
            className={cn(
              "p-1 transition-colors",
              adviceOpen ? "text-purple-600" : "text-zinc-400 hover:text-purple-600",
              adviceLoading && "animate-pulse"
            )}
            title="AI提案"
          >
            {adviceLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </button>
          {lead.mapsUrl && (
            <a
              href={lead.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-zinc-400 hover:text-blue-600 transition-colors"
              title="Google Maps"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {lead.convertedCustomer ? (
            <a
              href={`/dashboard/customers/${lead.convertedCustomer.id}`}
              className="text-[10px] text-emerald-600 hover:underline"
            >
              顧客へ
            </a>
          ) : (
            <button
              onClick={handleConvert}
              disabled={isPending}
              className="p-1 text-zinc-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
              title="顧客に転換"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
    {hearingOpen && (
      <tr>
        <td colSpan={canSelect ? 10 : 9} className="px-0 py-0">
          <HearingSheetForm
            leadId={lead.id}
            leadName={lead.name}
            initial={hearingData ?? null}
            onClose={() => setHearingOpen(false)}
          />
        </td>
      </tr>
    )}
    {adviceOpen && (
      <tr>
        <td colSpan={canSelect ? 10 : 9} className="px-0 py-0">
          <div className="bg-purple-50 border-t border-b border-purple-100 px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">AI営業提案 — {lead.name}</span>
              </div>
              <button
                onClick={() => setAdviceOpen(false)}
                className="text-purple-400 hover:text-purple-600"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            {adviceLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                <span className="text-xs text-purple-600">提案を生成中...</span>
              </div>
            ) : (
              <div className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap prose prose-sm max-w-none prose-headings:text-purple-900 prose-strong:text-purple-900">
                {advice}
              </div>
            )}
          </div>
        </td>
      </tr>
    )}
    </>
  );
}
