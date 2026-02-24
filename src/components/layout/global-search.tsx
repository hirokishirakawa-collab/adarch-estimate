"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, FolderOpen, Handshake, X } from "lucide-react";

type SearchResults = {
  customers: { id: string; name: string; nameKana: string | null }[];
  projects: { id: string; title: string; status: string }[];
  deals: { id: string; title: string; status: string; customerId: string }[];
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    customers: [],
    projects: [],
    deals: [],
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // モーダルが開いたらクリア＆フォーカス
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ customers: [], projects: [], deals: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ESC キーで閉じる
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // デバウンスして検索 API を呼び出す
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ customers: [], projects: [], deals: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // ネットワークエラーは無視
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onClose();
    },
    [router, onClose]
  );

  const hasResults =
    results.customers.length > 0 ||
    results.projects.length > 0 ||
    results.deals.length > 0;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 入力欄 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="顧客・案件・商談を検索..."
            className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200">
            ESC
          </kbd>
        </div>

        {/* 検索結果 */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="py-8 text-center text-sm text-zinc-400">
              検索中...
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="py-8 text-center text-sm text-zinc-400">
              「{query}」に一致する結果がありません
            </div>
          )}

          {/* 顧客 */}
          {!loading && results.customers.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                顧客
              </div>
              {results.customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left transition-colors border-b border-zinc-50"
                >
                  <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800 truncate">{c.name}</p>
                    {c.nameKana && (
                      <p className="text-xs text-zinc-400 truncate">{c.nameKana}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 案件（プロジェクト） */}
          {!loading && results.projects.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                案件
              </div>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/dashboard/projects/${p.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left transition-colors border-b border-zinc-50"
                >
                  <FolderOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-zinc-800 truncate">{p.title}</p>
                </button>
              ))}
            </div>
          )}

          {/* 商談 */}
          {!loading && results.deals.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                商談
              </div>
              {results.deals.map((d) => (
                <button
                  key={d.id}
                  onClick={() =>
                    navigate(`/dashboard/customers/${d.customerId}`)
                  }
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left transition-colors border-b border-zinc-50"
                >
                  <Handshake className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-zinc-800 truncate">{d.title}</p>
                </button>
              ))}
            </div>
          )}

          {/* 空の状態（未入力） */}
          {!query && (
            <div className="py-8 text-center text-sm text-zinc-400">
              顧客名・案件名・商談名を入力してください
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-4 py-2 border-t border-zinc-100 flex items-center gap-4 text-[11px] text-zinc-400">
          <span>
            <kbd className="bg-zinc-100 px-1 rounded border border-zinc-200">↵</kbd>{" "}
            選択して移動
          </span>
          <span>
            <kbd className="bg-zinc-100 px-1 rounded border border-zinc-200">ESC</kbd>{" "}
            閉じる
          </span>
        </div>
      </div>
    </div>
  );
}
