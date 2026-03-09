"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Phone, ArrowRightLeft, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_OPTIONS, getLeadStatusOption, getPriorityLabel } from "@/lib/constants/leads";
import { updateLeadStatus, updateLeadMemo, assignLead, convertLeadToCustomer } from "@/lib/actions/lead";
import { Button } from "@/components/ui/button";

interface LeadRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
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
}

export function LeadListTable({ leads, users }: Props) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-12 text-center">
        <p className="text-sm text-zinc-400">リードが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
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
              <LeadRow key={lead.id} lead={lead} users={users} />
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
}: {
  lead: LeadRow;
  users: Array<{ id: string; name: string | null; email: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoValue, setMemoValue] = useState(lead.memo ?? "");

  const statusOpt = getLeadStatusOption(lead.status);
  const priority = getPriorityLabel(lead.scoreTotal);

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
    <tr
      className={cn(
        "border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors",
        isPending && "opacity-50"
      )}
    >
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
  );
}
