"use client";

import { FileText, Eye, Pencil, Trash2, Link2, Check, Globe, GlobeLock } from "lucide-react";
import { PROPOSAL_INDUSTRY_OPTIONS } from "@/lib/constants/proposals";
import { useState } from "react";
import { ProposalPreview } from "./proposal-preview";
import { ProposalEditor } from "./proposal-editor";

interface ProposalData {
  id: string;
  companyName: string;
  industry: string;
  challenge: string;
  content: any;
  createdAt: string;
  slug?: string | null;
  isPublished?: boolean;
}

interface ProposalListProps {
  proposals: ProposalData[];
  isAdmin?: boolean;
  onRefresh?: () => void;
}

export function ProposalList({ proposals, isAdmin, onRefresh }: ProposalListProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getIndustryLabel = (value: string) => {
    return PROPOSAL_INDUSTRY_OPTIONS.find((o) => o.value === value)?.label || value;
  };

  const getPublicUrl = (slug: string) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/p/${slug}`;
  };

  const handleCopyUrl = async (slug: string, id: string) => {
    const url = getPublicUrl(slug);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    try {
      const res = await fetch(`/api/proposals/${id}/publish`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // コピー
        const url = getPublicUrl(data.slug);
        await navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        onRefresh?.();
      }
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (id: string) => {
    if (!confirm("公開を取り消しますか？URLが無効になります。")) return;
    const res = await fetch(`/api/proposals/${id}/publish`, { method: "DELETE" });
    if (res.ok) onRefresh?.();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この提案書を削除しますか？")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (res.ok) onRefresh?.();
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
            <div key={p.id} className="px-5 py-3 hover:bg-zinc-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-800">{p.companyName}</p>
                    {p.isPublished && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 rounded">
                        <Globe className="w-2.5 h-2.5" />
                        公開中
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {getIndustryLabel(p.industry)} · {new Date(p.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditId(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    編集
                  </button>
                  <button
                    onClick={() => setPreviewId(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    プレビュー
                  </button>
                  {!p.isPublished ? (
                    <button
                      onClick={() => handlePublish(p.id)}
                      disabled={publishingId === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      公開
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCopyUrl(p.slug!, p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        {copiedId === p.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            コピー済み
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5" />
                            URLコピー
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleUnpublish(p.id)}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        title="公開を取り消す"
                      >
                        <GlobeLock className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
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
              {/* 公開中のURL表示 */}
              {p.isPublished && p.slug && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="text-[11px] text-zinc-400 bg-zinc-50 px-2 py-1 rounded">
                    {getPublicUrl(p.slug)}
                  </code>
                </div>
              )}
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

      {editId && (() => {
        const editProposal = proposals.find((p) => p.id === editId);
        if (!editProposal) return null;
        return (
          <ProposalEditor
            proposal={editProposal}
            onClose={() => setEditId(null)}
            onSaved={() => {
              setEditId(null);
              onRefresh?.();
            }}
          />
        );
      })()}
    </>
  );
}
