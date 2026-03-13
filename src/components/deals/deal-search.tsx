"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";

interface Deal {
  id: string;
  title: string;
  status: string;
  customer: { name: string };
}

interface Props {
  deals: Deal[];
  statusLabels: Record<string, string>;
}

export function DealSearch({ deals, statusLabels }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.trim()
    ? deals.filter((d) =>
        d.customer.name.toLowerCase().includes(query.toLowerCase()) ||
        d.title.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 w-56 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
        <Search className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="会社名で検索..."
          className="w-full text-xs bg-transparent outline-none placeholder:text-zinc-400"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-zinc-400 text-center">該当する商談がありません</div>
          ) : (
            filtered.map((d) => (
              <Link
                key={d.id}
                href={`/dashboard/deals/${d.id}`}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 transition-colors"
              >
                <p className="text-xs font-medium text-zinc-900">{d.customer.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-zinc-400">{d.title}</span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-px rounded">
                    {statusLabels[d.status] ?? d.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
