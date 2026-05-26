"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Square, HandMetal, Loader2, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { bulkClaimTvcmLeads, bulkTransitionTvcmLeads } from "@/lib/actions/lead";
import { TvcmPoolCard, type TvcmPoolLead } from "./tvcm-pool-card";

interface Props {
  leads: TvcmPoolLead[];
  isAdmin: boolean;
}

export function TvcmPoolUnclaimedSection({ leads, isAdmin }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [resultMsg, setResultMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = leads.length > 0 && selectedIds.size === leads.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map((l) => l.id)));
  };

  const handleBulkClaim = () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `選択した ${selectedIds.size} 件をまとめて担当します。よろしいですか？\n（claimした案件は他のパートナーが取れなくなります）`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await bulkClaimTvcmLeads(Array.from(selectedIds));
      if (!res.success) {
        setResultMsg({ kind: "err", text: res.error ?? "一括claimに失敗しました" });
        return;
      }
      const parts: string[] = [];
      if (res.claimed > 0) parts.push(`${res.claimed}件をclaim`);
      if (res.skipped > 0) parts.push(`${res.skipped}件は既に他のパートナーがclaim済`);
      setResultMsg({
        kind: res.claimed > 0 ? "ok" : "err",
        text: parts.join(" / ") || "対象がありませんでした",
      });
      setSelectedIds(new Set());
    });
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `選択した ${selectedIds.size} 件をプールから外します（却下扱い）。よろしいですか？\n履歴には記録が残り、次回クロールでも復活しません。`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await bulkTransitionTvcmLeads(Array.from(selectedIds), "reject");
      if (!res.success) {
        setResultMsg({ kind: "err", text: res.error ?? "一括削除に失敗しました" });
        return;
      }
      setResultMsg({
        kind: "ok",
        text: `${res.updated}件 をプールから外しました`,
      });
      setSelectedIds(new Set());
    });
  };

  return (
    <div className="space-y-2">
      {/* 一括claim ツールバー */}
      <div className="flex items-center justify-between gap-3 bg-rose-50/60 border border-rose-200 rounded-lg px-3 py-2">
        <button
          onClick={toggleSelectAll}
          disabled={leads.length === 0}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 hover:text-rose-700 disabled:opacity-40"
        >
          {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          {allSelected ? "全選択解除" : "全選択"}
          {selectedIds.size > 0 && (
            <span className="text-[10px] font-bold text-rose-700 bg-white border border-rose-200 px-1.5 py-0.5 rounded ml-1">
              {selectedIds.size} 件選択中
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && selectedIds.size > 0 && (
            <button
              onClick={handleBulkReject}
              disabled={isPending}
              className="text-xs font-medium text-rose-700 bg-white border border-rose-300 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              title="プールから外す（却下扱い・本部のみ）"
            >
              <Trash2 className="w-3.5 h-3.5" />
              プールから外す
            </button>
          )}
          <button
            onClick={handleBulkClaim}
            disabled={isPending || selectedIds.size === 0}
            className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <HandMetal className="w-3.5 h-3.5" />
                選択した {selectedIds.size} 件をまとめて担当
              </>
            )}
          </button>
        </div>
      </div>

      {resultMsg && (
        <div
          className={`text-[11px] flex items-center gap-1 px-3 py-2 rounded-lg border ${
            resultMsg.kind === "ok"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-rose-700 bg-rose-50 border-rose-200"
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

      {leads.map((lead) => (
        <TvcmPoolCard
          key={lead.id}
          lead={lead}
          claimable={true}
          isAdmin={isAdmin}
          selectable={true}
          selected={selectedIds.has(lead.id)}
          onToggleSelect={() => toggleSelect(lead.id)}
        />
      ))}
    </div>
  );
}
