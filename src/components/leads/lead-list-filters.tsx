"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { LEAD_STATUS_OPTIONS } from "@/lib/constants/leads";

interface Props {
  users: Array<{ id: string; name: string | null; email: string }>;
}

export function LeadListFilters({ users }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const assigneeId = searchParams.get("assigneeId") ?? "";

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // フィルター変更時は1ページ目に戻す
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* キーワード検索 */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="会社名・住所・メモで検索..."
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParam("q", (e.target as HTMLInputElement).value);
            }
          }}
          className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* ステータスフィルター */}
      <select
        value={status}
        onChange={(e) => updateParam("status", e.target.value)}
        className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      >
        <option value="">全ステータス</option>
        {LEAD_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.icon} {opt.label}
          </option>
        ))}
      </select>

      {/* 担当者フィルター */}
      <select
        value={assigneeId}
        onChange={(e) => updateParam("assigneeId", e.target.value)}
        className="text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      >
        <option value="">全担当者</option>
        <option value="unassigned">未アサイン</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name ?? u.email}
          </option>
        ))}
      </select>

      {/* リセット */}
      {(q || status || assigneeId) && (
        <button
          onClick={() => router.replace(pathname)}
          className="text-xs text-zinc-500 hover:text-zinc-700 underline"
        >
          クリア
        </button>
      )}
    </div>
  );
}
