"use client";

import { useState } from "react";
import { Trash2, Eye, ChevronDown, ChevronRight } from "lucide-react";

interface ProductionItem {
  id: string;
  title: string;
  type: string;
  month: string | null;
  clientName: string;
  createdByName: string;
  createdAt: string;
  contentPreview: string;
}

const TYPE_LABELS: Record<string, string> = {
  SNS_PLAN: "SNSプラン",
  CUTSHEET: "カット表",
  CAPTION: "キャプション",
  REPORT: "レポート",
  SHOOTING_GUIDE: "撮影指示書",
  SHORT_VIDEO: "ショート動画",
  THUMBNAIL: "サムネイル",
};

export function LibraryList({
  productions: initialProductions,
  isAdmin,
}: {
  productions: ProductionItem[];
  isAdmin: boolean;
}) {
  const [productions, setProductions] = useState(initialProductions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) return;

    setDeleting(id);
    const res = await fetch(`/api/studio/productions/${id}`, { method: "DELETE" });

    if (res.ok) {
      setProductions((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert("削除に失敗しました");
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-2">
      {productions.map((p) => (
        <div key={p.id} className="bg-white rounded-xl border hover:border-fuchsia-200 transition">
          <div className="px-5 py-4 flex items-center justify-between">
            <button
              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              {expandedId === p.id ? (
                <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-zinc-900 truncate">{p.title}</h3>
                <p className="text-sm text-zinc-500">
                  {p.clientName} · {p.month} · {p.createdByName} · {new Date(p.createdAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <span className="text-xs px-2 py-1 bg-fuchsia-50 text-fuchsia-700 rounded">
                {TYPE_LABELS[p.type] || p.type}
              </span>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(p.id, p.title)}
                  disabled={deleting === p.id}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  title="削除（Admin）"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {expandedId === p.id && (
            <div className="px-5 pb-4 border-t pt-3">
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">{p.contentPreview}...</p>
              <a
                href={`/api/studio/productions/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-fuchsia-600 hover:text-fuchsia-800 mt-2"
              >
                <Eye className="h-3.5 w-3.5" />
                全文を表示（JSON）
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
