"use client";

import { FileText, Eye, Pencil, Trash2, Link2, Check, Globe, GlobeLock, X, Loader2 } from "lucide-react";
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
  user?: { name: string | null; email: string };
}

interface ProposalListProps {
  proposals: ProposalData[];
  isAdmin?: boolean;
  onRefresh?: () => void;
}

const PROPOSALS_DOMAIN = "proposals.adarch.co.jp";

export function ProposalList({ proposals, isAdmin, onRefresh }: ProposalListProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 公開ダイアログ
  const [publishDialogId, setPublishDialogId] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const getIndustryLabel = (value: string) => {
    return PROPOSAL_INDUSTRY_OPTIONS.find((o) => o.value === value)?.label || value;
  };

  const getPublicUrl = (slug: string) => {
    return `https://${PROPOSALS_DOMAIN}/p/${slug}`;
  };

  const handleCopyUrl = async (slug: string, id: string) => {
    const url = getPublicUrl(slug);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openPublishDialog = (id: string, companyName: string) => {
    // 企業名からslug候補を生成（英数字+ハイフンに変換）
    const suggested = companyName
      .replace(/株式会社|有限会社|合同会社|（株）|\(株\)/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    setPublishDialogId(id);
    setSlugInput(suggested || "");
    setPublishError("");
  };

  const handlePublish = async () => {
    if (!publishDialogId) return;
    const slug = slugInput.trim();
    if (!slug) {
      setPublishError("URLを入力してください");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      setPublishError("半角英数字・ハイフン・アンダースコアのみ使用できます");
      return;
    }

    setPublishing(true);
    setPublishError("");
    try {
      const res = await fetch(`/api/proposals/${publishDialogId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.error || "公開に失敗しました");
        return;
      }
      // URLをクリップボードにコピー
      const url = getPublicUrl(data.slug);
      await navigator.clipboard.writeText(url);
      setCopiedId(publishDialogId);
      setTimeout(() => setCopiedId(null), 2000);
      setPublishDialogId(null);
      onRefresh?.();
    } catch {
      setPublishError("通信エラーが発生しました");
    } finally {
      setPublishing(false);
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
                    {p.user?.name && <span> · {p.user.name}</span>}
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
                      onClick={() => openPublishDialog(p.id, p.companyName)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
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

      {/* 公開ダイアログ */}
      {publishDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-800">提案書を公開</h3>
              <button onClick={() => setPublishDialogId(null)} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-3">
              クライアントに共有するURLを設定してください。
            </p>

            {/* URLプレビュー */}
            <div className="bg-zinc-50 rounded-lg px-3 py-2.5 mb-4">
              <p className="text-[10px] text-zinc-400 mb-1">公開URL</p>
              <p className="text-sm text-zinc-700 font-mono break-all">
                https://{PROPOSALS_DOMAIN}/p/<span className="text-blue-600 font-semibold">{slugInput || "..."}</span>
              </p>
            </div>

            {/* slug入力 */}
            <label className="block text-xs text-zinc-500 mb-1">URL（半角英数字・ハイフン）</label>
            <input
              type="text"
              value={slugInput}
              onChange={(e) => {
                setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                setPublishError("");
              }}
              placeholder="tanaka-shoten"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") handlePublish(); }}
            />

            {publishError && (
              <p className="text-xs text-red-600 mt-2">{publishError}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setPublishDialogId(null)}
                className="px-4 py-2 text-xs font-medium text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !slugInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {publishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                公開してURLをコピー
              </button>
            </div>
          </div>
        </div>
      )}

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
