"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Search, Building2, MessageSquare, Users2 } from "lucide-react";

interface Row {
  id: string;
  domain: string;
  companyName: string;
  branchId: string;
  sentAt: string;
  hasResponse: boolean;
  branch: { name: string };
}

export function SentHistory({
  rows,
  total,
  responded,
  page,
  pageSize,
  query,
  myBranchName,
}: {
  rows: Row[];
  total: number;
  responded: number;
  page: number;
  pageSize: number;
  query: string;
  myBranchName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState(query);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const rate = total > 0 ? Math.round((responded / total) * 1000) / 10 : 0;

  function search(nextQuery: string, nextPage: number) {
    const p = new URLSearchParams(searchParams.toString());
    if (nextQuery) p.set("q", nextQuery);
    else p.delete("q");
    if (nextPage > 1) p.set("page", String(nextPage));
    else p.delete("page");
    router.push(`/dashboard/auto-sales/history?${p.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/dashboard/auto-sales"
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">過去の送付先（参照）</h1>
        </div>
        <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
          廃止した自動営業が過去に送信した企業の記録です。<span className="text-zinc-700">重複して当たらないための参照用</span>で、新しく追加されることはありません。
        </p>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-700 opacity-70">送信済み企業（全社）</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{total.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700 opacity-70">反響あり</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{responded.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-xs font-medium text-purple-700 opacity-70">反響率</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{rate}%</p>
        </div>
      </div>

      {/* 検索 */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search(input, 1);
              }}
              placeholder="会社名やドメインで検索（送る前にここで確認できます）"
              className="w-full text-sm border border-zinc-200 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <button
            onClick={() => search(input, 1)}
            className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 rounded-lg transition-colors"
          >
            検索
          </button>
          {query && (
            <button
              onClick={() => {
                setInput("");
                search("", 1);
              }}
              className="text-sm text-zinc-500 px-3 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">
              {query ? "該当する送信履歴はありません" : "まだ送信履歴がありません"}
            </p>
            {query && (
              <p className="text-xs text-zinc-400 mt-1">
                この会社にはまだ誰も送っていません。営業先に登録できます。
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left font-medium text-zinc-500 text-xs px-4 py-3">企業名</th>
                  <th className="text-left font-medium text-zinc-500 text-xs px-4 py-3">ドメイン</th>
                  <th className="text-left font-medium text-zinc-500 text-xs px-4 py-3">送信した拠点</th>
                  <th className="text-left font-medium text-zinc-500 text-xs px-4 py-3">送信日</th>
                  <th className="text-left font-medium text-zinc-500 text-xs px-4 py-3">反響</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.companyName}</td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{r.domain}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          r.branch.name === myBranchName
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {r.branch.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(r.sentAt).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-4 py-3">
                      {r.hasResponse ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                          <MessageSquare className="w-3 h-3" />
                          あり
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ページャ */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              {(page - 1) * pageSize + 1}〜{Math.min(page * pageSize, total)} / {total.toLocaleString()}件
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => search(query, page - 1)}
                disabled={page <= 1}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                前へ
              </button>
              <span className="text-xs text-zinc-500">
                {page} / {lastPage}
              </span>
              <button
                onClick={() => search(query, page + 1)}
                disabled={page >= lastPage}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-400 flex items-center gap-1.5 leading-relaxed">
        <Users2 className="w-3.5 h-3.5 shrink-0" />
        自動営業は2026-08-17に廃止しました。送信は人が行う運用（アウトリーチ／営業フォーム）に一本化しています。
      </p>
    </div>
  );
}
