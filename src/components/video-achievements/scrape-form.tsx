"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkSaveAchievements } from "@/lib/actions/video-achievement";
import { VIDEO_TYPE_OPTIONS } from "@/lib/constants/video-achievements";
import { Search, Loader2, CheckSquare, Square, Save } from "lucide-react";

interface ScrapedItem {
  clientName:   string;
  prefecture:   string;
  industry:     string;
  videoType:    string;
  description:  string | null;
  referenceUrl: string | null;
  publishedAt:  string | null;
}

export function ScrapeForm() {
  const router = useRouter();
  const [url, setUrl]                     = useState("");
  const [productionCompany, setProductionCompany] = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [detectedCompany, setDetectedCompany] = useState<string | null>(null);
  const [items, setItems]                 = useState<ScrapedItem[]>([]);
  const [selected, setSelected]           = useState<Set<number>>(new Set());
  const [isPending, startTransition]      = useTransition();
  const [saveResult, setSaveResult]       = useState<{ saved: number; skipped: number } | null>(null);

  const videoTypeLabel = (val: string) =>
    VIDEO_TYPE_OPTIONS.find((o) => o.value === val)?.label ?? val;

  // スクレイピング実行
  const handleScrape = async () => {
    if (!url.trim()) { setError("URLを入力してください"); return; }
    setError(null);
    setItems([]);
    setSelected(new Set());
    setSaveResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/scrape-works", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim(), productionCompany: productionCompany.trim() }),
      });
      const data = await res.json() as {
        items?: ScrapedItem[];
        productionCompany?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        setError(data.error ?? "スクレイピングに失敗しました");
        return;
      }
      setDetectedCompany(data.productionCompany ?? null);
      setItems(data.items ?? []);
      // 全選択状態にする
      setSelected(new Set((data.items ?? []).map((_, i) => i)));
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // チェックボックストグル
  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((_, i) => i)));
  };
  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelected(next);
  };

  // 選択データを保存
  const handleSave = () => {
    const toSave = items
      .filter((_, i) => selected.has(i))
      .map((item) => ({
        companyName:       item.clientName,
        prefecture:        item.prefecture,
        industry:          item.industry,
        productionCompany: productionCompany.trim() || detectedCompany || "不明",
        videoType:         item.videoType,
        referenceUrl:      item.referenceUrl,
        contentSummary:    item.description,
        publishedAt:       item.publishedAt,
      }));
    if (toSave.length === 0) { setError("1件以上選択してください"); return; }

    startTransition(async () => {
      const result = await bulkSaveAchievements(toSave);
      if (result.error) { setError(result.error); return; }
      setSaveResult({ saved: result.saved, skipped: result.skipped });
    });
  };

  return (
    <div className="space-y-6">
      {/* URL入力フォーム */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            制作会社の実績ページURL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://〇〇映像.co.jp/works"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-zinc-400 mt-1">
            /works・/case・/portfolio・/制作事例 などのURLを入力してください
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            制作会社名（任意・空白で自動検出）
          </label>
          <input
            type="text"
            value={productionCompany}
            onChange={(e) => setProductionCompany(e.target.value)}
            placeholder="例: 株式会社〇〇映像"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleScrape}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />解析中...</>
            : <><Search className="w-4 h-4" />実績を取込む</>
          }
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* 保存完了 */}
      {saveResult && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <p className="font-medium">保存完了</p>
          <p className="text-xs mt-0.5">
            新規保存: {saveResult.saved}件 ／ スキップ（重複）: {saveResult.skipped}件
          </p>
          <button
            onClick={() => router.push("/dashboard/video-achievements")}
            className="mt-2 text-xs text-emerald-700 underline font-medium"
          >
            動画実績DBで確認する →
          </button>
        </div>
      )}

      {/* 抽出結果 */}
      {items.length > 0 && !saveResult && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {detectedCompany && (
                  <span className="text-zinc-500 font-normal mr-2">
                    [{detectedCompany}]
                  </span>
                )}
                {items.length} 件が抽出されました
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">保存する企業にチェックを入れてください</p>
            </div>
            <button
              onClick={handleSave}
              disabled={isPending || selected.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />保存中...</>
                : <><Save className="w-3.5 h-3.5" />選択 {selected.size} 件を保存</>
              }
            </button>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-4 py-2.5 w-8">
                  <button onClick={toggleAll} className="text-zinc-400 hover:text-zinc-700">
                    {selected.size === items.length
                      ? <CheckSquare className="w-4 h-4 text-blue-600" />
                      : <Square className="w-4 h-4" />
                    }
                  </button>
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-600">発注元企業名</th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-600">所在地</th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-600">業種</th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-600">動画種別</th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-600">掲載日</th>
                <th className="text-left px-3 py-2.5 font-medium text-zinc-600 max-w-xs">制作内容</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {items.map((item, i) => (
                <tr
                  key={i}
                  className={`transition-colors cursor-pointer ${selected.has(i) ? "bg-blue-50/40" : "hover:bg-zinc-50"}`}
                  onClick={() => toggle(i)}
                >
                  <td className="px-4 py-3 text-center">
                    {selected.has(i)
                      ? <CheckSquare className="w-4 h-4 text-blue-600" />
                      : <Square className="w-4 h-4 text-zinc-300" />
                    }
                  </td>
                  <td className="px-3 py-3 font-medium text-zinc-900 whitespace-nowrap">{item.clientName}</td>
                  <td className="px-3 py-3 text-zinc-600 whitespace-nowrap">{item.prefecture}</td>
                  <td className="px-3 py-3 text-zinc-600 whitespace-nowrap">{item.industry}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-medium">
                      {videoTypeLabel(item.videoType)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-500 whitespace-nowrap text-[11px]">
                    {item.publishedAt ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-zinc-500 max-w-xs">
                    <p className="line-clamp-2">{item.description ?? "—"}</p>
                    {item.referenceUrl && (
                      <a
                        href={item.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-500 hover:underline text-[11px] mt-0.5 inline-block"
                      >
                        参照リンク →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 抽出ゼロ */}
      {!loading && items.length === 0 && !error && url && (
        <div className="text-center py-12 text-zinc-400 text-sm">
          実績データが見つかりませんでした。別のURLを試してください。
        </div>
      )}
    </div>
  );
}
