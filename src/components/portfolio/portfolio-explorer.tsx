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
  if (mime === "folder") return <Folder className={`${size} text-blue-400`} />;
  if (mime.startsWith("video/")) return <Film className={`${size} text-pink-400`} />;
  if (mime.startsWith("image/")) return <ImageIcon className={`${size} text-emerald-400`} />;
  if (mime.includes("pdf")) return <FileText className={`${size} text-red-400`} />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <FileSpreadsheet className={`${size} text-green-400`} />;
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return <Presentation className={`${size} text-orange-400`} />;
  return <FileText className={`${size} text-zinc-500`} />;
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
          <div className="w-9 h-9 bg-blue-600/10 rounded-xl flex items-center justify-center">
            <HardDrive className="w-[1.125rem] h-[1.125rem] text-blue-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">実績フォルダ検索</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Google Drive の実績フォルダから素材・案件を検索
            </p>
          </div>
        </div>
        {lastSyncedAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
            <RefreshCw className="w-3 h-3" />
            最終同期: {new Date(lastSyncedAt).toLocaleString("ja-JP")}
          </div>
        )}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">フォルダ</p>
            <p className="text-lg font-bold text-white leading-tight">{folderCount}</p>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
            <FileVideo className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">ファイル</p>
            <p className="text-lg font-bold text-white leading-tight">{fileCount}</p>
          </div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Files className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">検索結果</p>
            <p className="text-lg font-bold text-white leading-tight">{totalCount}</p>
          </div>
        </div>
      </div>

      {/* AI実績提案 */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI実績提案</h2>
            <p className="text-[11px] text-zinc-500">
              自然文で実績を検索し、クライアント向けの提案文を自動生成
            </p>
          </div>
        </div>
        <div className="p-5">
          <form onSubmit={handleAiSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                ref={aiInputRef}
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="例: 不動産系のプロモーション動画の実績はありますか？"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading || !aiQuery.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 flex items-center gap-2 transition"
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
            <div className="mt-3 p-3 bg-red-950/30 border border-red-900/30 rounded-lg text-sm text-red-400">
              {aiError}
            </div>
          )}

          {/* AI回答 */}
          {aiResult && (
            <div className="mt-4 space-y-3">
              <div className="relative bg-zinc-800/40 border border-zinc-700/40 rounded-lg p-4">
                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700 transition"
                  title="コピー"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <div className="text-sm text-zinc-300 whitespace-pre-wrap pr-8 leading-relaxed">
                  {aiResult.answer}
                </div>
              </div>

              {/* 関連ファイルリンク */}
              {aiResult.items.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-wide">
                    関連ファイル ({aiResult.items.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aiResult.items.map((item) => (
                      <a
                        key={item.id}
                        href={item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 hover:border-blue-500/60 hover:text-white transition"
                      >
                        {getMimeIcon(item.mimeType, "w-3.5 h-3.5")}
                        <span className="truncate max-w-[200px]">{item.name}</span>
                        <ExternalLink className="w-3 h-3 text-zinc-600 flex-shrink-0" />
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ファイル名・フォルダ名・パスで検索..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-900/60 border border-zinc-800/60 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 hover:text-white disabled:opacity-50 border border-zinc-700/50 transition"
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
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-zinc-900/60 border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
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
          <p className="text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-wide">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/60 border border-zinc-800/60 rounded-lg text-xs text-zinc-400 hover:border-blue-500/50 hover:text-white transition"
              >
                <Folder className="w-3 h-3 text-blue-400/70" />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 結果テーブル */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800/60 flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">
              {query
                ? `「${query}」に一致する実績が見つかりません`
                : "まだ実績データが同期されていません"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">名前</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">パス</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">種別</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">サイズ</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">更新日</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">開く</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-800/30 transition"
                  >
                    <td className="px-4 py-2.5">
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${item.depth * 16}px` }}
                      >
                        {getMimeIcon(item.mimeType)}
                        <span className="text-zinc-200 truncate max-w-xs">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 truncate max-w-sm text-xs">
                      {item.path}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        item.itemType === "folder"
                          ? "bg-blue-500/10 text-blue-400"
                          : item.mimeType.startsWith("video/")
                          ? "bg-pink-500/10 text-pink-400"
                          : item.mimeType.startsWith("image/")
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-zinc-800/60 text-zinc-500"
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
                    <td className="px-4 py-2.5 text-right text-zinc-500 text-xs tabular-nums">
                      {item.itemType === "file" && item.sizeMb > 0
                        ? `${item.sizeMb.toFixed(1)} MB`
                        : ""}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs tabular-nums">
                      {new Date(item.lastUpdated).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <a
                        href={item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition"
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
          <div className="px-4 py-2.5 border-t border-zinc-800/60 text-xs text-zinc-600">
            {totalCount}件中 200件を表示 - 検索で絞り込んでください
          </div>
        )}
      </div>
    </div>
  );
}
