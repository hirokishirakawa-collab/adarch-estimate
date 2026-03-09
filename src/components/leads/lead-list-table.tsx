"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Phone, ArrowRightLeft, Pencil, Check, X, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_OPTIONS, getLeadStatusOption, getPriorityLabel } from "@/lib/constants/leads";
import { updateLeadStatus, updateLeadMemo, assignLead, convertLeadToCustomer, deleteSelectedLeads } from "@/lib/actions/lead";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeadRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number;
  ratingCount: number;
  types: string[];
  businessStatus: string | null;
  scoreTotal: number;
  scoreComment: string | null;
  status: string;
  memo: string | null;
  mapsUrl: string | null;
  industry: string | null;
  area: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  convertedCustomer: { id: string; name: string } | null;
}

interface Props {
  leads: LeadRow[];
  users: Array<{ id: string; name: string | null; email: string }>;
  isAdmin?: boolean;
}

export function LeadListTable({ leads, users, isAdmin }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, startDeleting] = useTransition();

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

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 text-center">
        <p className="text-sm text-zinc-400">リードが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      {/* 操作アイコン凡例 */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-100 bg-zinc-50/50">
        <span className="text-[11px] text-zinc-400">操作アイコン:</span>
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

      {/* 選択削除バー */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-700">
            <strong>{selectedIds.size}件</strong> 選択中
          </p>
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
            選択した{selectedIds.size}件を削除
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {isAdmin && (
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
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-16">
                スコア
              </th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-zinc-500 w-28">
                ステータス
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-32">
                担当者
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 w-28 hidden md:table-cell">
                電話
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
  selected,
  onToggleSelect,
}: {
  lead: LeadRow;
  users: Array<{ id: string; name: string | null; email: string }>;
  isAdmin?: boolean;
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

  const statusOpt = getLeadStatusOption(lead.status);
  const priority = getPriorityLabel(lead.scoreTotal);

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
          memo: lead.memo,
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

  return (
    <>
    <tr
      className={cn(
        "border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors",
        isPending && "opacity-50"
      )}
    >
      {/* チェックボックス */}
      {isAdmin && (
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
      </td>

      {/* スコア */}
      <td className="px-3 py-3 text-center">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border",
            priority.className
          )}
          title={lead.scoreComment ?? ""}
        >
          {priority.emoji} {lead.scoreTotal}
        </span>
      </td>

      {/* ステータス */}
      <td className="px-3 py-3 text-center">
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={isPending || lead.status === "DEAL_CONVERTED"}
          className={cn(
            "text-[11px] font-medium border rounded px-1.5 py-0.5 cursor-pointer focus:outline-none",
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
      </td>

      {/* 電話 */}
      <td className="px-3 py-3 hidden md:table-cell">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <Phone className="w-3 h-3" />
            {lead.phone}
          </a>
        ) : (
          <span className="text-xs text-zinc-300">-</span>
        )}
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
    {adviceOpen && (
      <tr>
        <td colSpan={isAdmin ? 8 : 7} className="px-0 py-0">
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
