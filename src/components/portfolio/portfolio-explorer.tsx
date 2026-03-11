"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
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
function getMimeIcon(mime: string) {
  if (mime === "folder") return <Folder className="w-4 h-4 text-blue-400" />;
  if (mime.startsWith("video/")) return <Film className="w-4 h-4 text-purple-400" />;
  if (mime.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-green-400" />;
  if (mime.includes("pdf")) return <FileText className="w-4 h-4 text-red-400" />;
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return <Presentation className="w-4 h-4 text-orange-400" />;
  return <FileText className="w-4 h-4 text-zinc-400" />;
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

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // 検索時はページリセット
    startTransition(() => router.push(`/dashboard/portfolio?${params.toString()}`));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    applyFilter("q", searchInput);
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            実績フォルダ検索
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Google Drive の実績フォルダから素材・案件を検索
          </p>
        </div>
        {lastSyncedAt && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <RefreshCw className="w-3 h-3" />
            最終同期: {new Date(lastSyncedAt).toLocaleString("ja-JP")}
          </div>
        )}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <p className="text-xs text-zinc-500">フォルダ数</p>
          <p className="text-lg font-bold text-white">{folderCount}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <p className="text-xs text-zinc-500">ファイル数</p>
          <p className="text-lg font-bold text-white">{fileCount}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <p className="text-xs text-zinc-500">検索結果</p>
          <p className="text-lg font-bold text-white">{totalCount}</p>
        </div>
      </div>

      {/* 検索バー */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ファイル名・フォルダ名・パスで検索..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
        >
          検索
        </button>
      </form>

      {/* フィルター */}
      <div className="flex gap-2">
        {[
          { value: "all", label: "すべて" },
          { value: "folder", label: "フォルダのみ" },
          { value: "file", label: "ファイルのみ" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => applyFilter("type", opt.value === "all" ? "" : opt.value)}
            className={`px-3 py-1 text-xs rounded-full border transition ${
              typeFilter === opt.value ||
              (opt.value === "all" && typeFilter === "all")
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* トップレベルフォルダ（クライアント一覧） */}
      {!query && topFolders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-2">
            クライアント / 案件フォルダ
          </h2>
          <div className="flex flex-wrap gap-2">
            {topFolders.map((f) => (
              <button
                key={f.name}
                onClick={() => {
                  setSearchInput(f.name);
                  applyFilter("q", f.name);
                }}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 hover:border-blue-500 hover:text-white transition"
              >
                <Folder className="w-3 h-3 inline mr-1" />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 結果テーブル */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            {query
              ? `「${query}」に一致する実績が見つかりません`
              : "まだ実績データが同期されていません。GASトリガーの設定を確認してください。"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="text-left px-4 py-2">名前</th>
                  <th className="text-left px-4 py-2">パス</th>
                  <th className="text-left px-4 py-2">種別</th>
                  <th className="text-right px-4 py-2">サイズ</th>
                  <th className="text-left px-4 py-2">更新日</th>
                  <th className="text-center px-4 py-2">開く</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-zinc-800/40 transition"
                  >
                    <td className="px-4 py-2">
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${item.depth * 12}px` }}
                      >
                        {getMimeIcon(item.mimeType)}
                        <span className="text-white truncate max-w-xs">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-zinc-500 truncate max-w-sm text-xs">
                      {item.path}
                    </td>
                    <td className="px-4 py-2 text-zinc-400 text-xs">
                      {item.itemType === "folder"
                        ? "フォルダ"
                        : item.mimeType.split("/").pop()?.split(".").pop() ??
                          "ファイル"}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-400 text-xs">
                      {item.itemType === "file" && item.sizeMb > 0
                        ? `${item.sizeMb.toFixed(1)} MB`
                        : ""}
                    </td>
                    <td className="px-4 py-2 text-zinc-400 text-xs">
                      {new Date(item.lastUpdated).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <a
                        href={item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-400 hover:text-blue-300"
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
          <div className="px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500">
            {totalCount}件中 200件を表示しています。検索で絞り込んでください。
          </div>
        )}
      </div>
    </div>
  );
}
