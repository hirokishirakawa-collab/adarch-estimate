"use client";

import { FileText, Eye, Trash2 } from "lucide-react";
import { PROPOSAL_INDUSTRY_OPTIONS } from "@/lib/constants/proposals";
import { useState } from "react";
import { ProposalPreview } from "./proposal-preview";

interface ProposalData {
  id: string;
  companyName: string;
  industry: string;
  challenge: string;
  content: any;
  createdAt: string;
}

interface ProposalListProps {
  proposals: ProposalData[];
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}

export function ProposalList({ proposals, isAdmin, onDelete }: ProposalListProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getIndustryLabel = (value: string) => {
    return PROPOSAL_INDUSTRY_OPTIONS.find((o) => o.value === value)?.label || value;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この提案書を削除しますか？")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (res.ok) onDelete?.(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (proposals.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
        <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
        <p className="text-sm text-zinc-400">まだ提案書がありません</p>
      </div>
    );
  }

  const previewProposal = previewId ? proposals.find((p) => p.id === previewId) : null;

  return (
    <>
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <p className="text-sm font-semibold text-zinc-800">生成済み提案書</p>
        </div>
        <div className="divide-y divide-zinc-100">
          {proposals.map((p) => (
            <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-50 transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800">{p.companyName}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {getIndustryLabel(p.industry)} · {new Date(p.createdAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setPreviewId(p.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  プレビュー
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewProposal && (
        <ProposalPreview
          proposal={previewProposal}
          onClose={() => setPreviewId(null)}
        />
      )}
    </>
  );
}
