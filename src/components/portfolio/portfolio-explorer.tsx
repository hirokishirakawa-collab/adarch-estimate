"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useRef } from "react";
import {
  Search,
  Folder,
  FileText,
  Film,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  ExternalLink,
  RefreshCw,
  HardDrive,
  Sparkles,
  Loader2,
  Copy,
  Check,
  FolderOpen,
  FileVideo,
  Files,
} from "lucide-react";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface PortfolioItemData {
  id: string;
  name: string;
  path: string;
  itemType: string;
  mimeType: string;
  depth: number;
  sizeMb: number;
  driveUrl: string;
  parentName: string | null;
  lastUpdated: string;
}

interface AiResult {
  answer: string;
  items: {
    id: string;
    name: string;
    path: string;
    itemType: string;
    mimeType: string;
    driveUrl: string;
  }[];
}

interface Props {
  items: PortfolioItemData[];
  totalCount: number;
  folderCount: number;
  fileCount: number;
  topFolders: { name: string; driveUrl: string }[];
  lastSyncedAt: string | null;
  query: string;
  typeFilter: string;
}

// ----------------------------------------------------------------
// MIME → アイコン
// ----------------------------------------------------------------
function getMimeIcon(mime: string, size = "w-4 h-4") {
  if (mime === "folder") return <Folder className={`${size} text-blue-600`} />;
  if (mime.startsWith("video/")) return <Film className={`${size} text-pink-600`} />;
  if (mime.startsWith("image/")) return <ImageIcon className={`${size} text-emerald-600`} />;
  if (mime.includes("pdf")) return <FileText className={`${size} text-red-600`} />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <FileSpreadsheet className={`${size} text-green-600`} />;
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return <Presentation className={`${size} text-orange-600`} />;
  return <FileText className={`${size} text-gray-500`} />;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export function PortfolioExplorer({
  items,
  totalCount,
  folderCount,
  fileCount,
  topFolders,
  lastSyncedAt,
  query,
  typeFilter,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(query);

  // AI検索
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [copied, setCopied] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`/dashboard/portfolio?${params.toString()}`));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    applyFilter("q", searchInput);
  }

  async function handleAiSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!aiQuery.trim() || aiLoading) return;

    setAiLoading(true);
    setAiError("");
    setAiResult(null);

    try {
      const res = await fetch("/api/portfolio/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "検索に失敗しました");
      }
      const data: AiResult = await res.json();
      setAiResult(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCopy() {
    if (!aiResult) return;
    await navigator.clipboard.writeText(aiResult.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <HardDrive className="w-[1.125rem] h-[1.125rem] text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">実績フォルダ検索</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Google Drive の実績フォルダから素材・案件を検索
            </p>
          </div>
        </div>
        {lastSyncedAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <RefreshCw className="w-3 h-3" />
            最終同期: {new Date(lastSyncedAt).toLocaleString("ja-JP")}
          </div>
        )}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500">フォルダ</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{folderCount}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
            <FileVideo className="w-4 h-4 text-pink-600" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500">ファイル</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{fileCount}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Files className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] text-gray-500">検索結果</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{totalCount}</p>
          </div>
        </div>
      </div>

      {/* AI実績提案 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-blue-100 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">AI実績提案</h2>
            <p className="text-[11px] text-blue-600">
              自然文で実績を検索し、クライアント向けの提案文を自動生成
            </p>
          </div>
        </div>
        <div className="p-5">
          <form onSubmit={handleAiSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={aiInputRef}
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="例: 不動産系のプロモーション動画の実績はありますか？"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading || !aiQuery.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2 transition"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              提案生成
            </button>
          </form>

          {/* AIエラー */}
          {aiError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {aiError}
            </div>
          )}

          {/* AI回答 */}
          {aiResult && (
            <div className="mt-4 space-y-3">
              <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-4">
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
                  title="コピー"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <div className="text-sm text-gray-800 whitespace-pre-wrap pr-8 leading-relaxed">
                  {aiResult.answer}
                </div>
              </div>

              {/* 関連ファイルリンク */}
              {aiResult.items.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                    関連ファイル ({aiResult.items.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiResult.items.map((item) => (
                      <a
                        key={item.id}
                        href={item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:border-blue-400 hover:text-blue-700 transition shadow-sm"
                      >
                        {getMimeIcon(item.mimeType, "w-3.5 h-3.5")}
                        <span className="truncate max-w-[200px]">{item.name}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 検索バー + フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ファイル名・フォルダ名・パスで検索..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-white text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 border border-gray-200 transition"
          >
            検索
          </button>
        </form>
        <div className="flex gap-1.5">
          {[
            { value: "all", label: "すべて" },
            { value: "folder", label: "フォルダ" },
            { value: "file", label: "ファイル" },
          ].map((opt) => {
            const isActive =
              typeFilter === opt.value || (opt.value === "all" && typeFilter === "all");
            return (
              <button
                key={opt.value}
                onClick={() => applyFilter("type", opt.value === "all" ? "" : opt.value)}
                className={`px-3 py-2 text-xs rounded-lg border transition ${
                  isActive
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* トップレベルフォルダ（クライアント一覧） */}
      {!query && topFolders.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            クライアント / 案件フォルダ
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topFolders.map((f) => (
              <button
                key={f.name}
                onClick={() => {
                  setSearchInput(f.name);
                  applyFilter("q", f.name);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:border-blue-400 hover:text-blue-700 transition"
              >
                <Folder className="w-3 h-3 text-blue-500" />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 結果テーブル */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">
              {query
                ? `「${query}」に一致する実績が見つかりません`
                : "まだ実績データが同期されていません"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">名前</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">パス</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">種別</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">サイズ</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">更新日</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">開く</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-2.5">
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${item.depth * 16}px` }}
                      >
                        {getMimeIcon(item.mimeType)}
                        <span className="text-gray-900 truncate max-w-xs font-medium">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 truncate max-w-sm text-xs">
                      {item.path}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        item.itemType === "folder"
                          ? "bg-blue-50 text-blue-700"
                          : item.mimeType.startsWith("video/")
                          ? "bg-pink-50 text-pink-700"
                          : item.mimeType.startsWith("image/")
                          ? "bg-emerald-50 text-emerald-700"
                          : item.mimeType.includes("pdf")
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {item.itemType === "folder"
                          ? "フォルダ"
                          : item.mimeType.startsWith("video/")
                          ? "動画"
                          : item.mimeType.startsWith("image/")
                          ? "画像"
                          : item.mimeType.includes("pdf")
                          ? "PDF"
                          : item.mimeType.includes("presentation") || item.mimeType.includes("powerpoint")
                          ? "スライド"
                          : "ファイル"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500 text-xs tabular-nums">
                      {item.itemType === "file" && item.sizeMb > 0
                        ? `${item.sizeMb.toFixed(1)} MB`
                        : ""}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs tabular-nums">
                      {new Date(item.lastUpdated).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <a
                        href={item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalCount > 200 && (
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500 bg-gray-50">
            {totalCount}件中 200件を表示 - 検索で絞り込んでください
          </div>
        )}
      </div>
    </div>
  );
}
