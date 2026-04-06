"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";

interface Props {
  skillCategories: { id: string; name: string }[];
  prefectures: { name: string; count: number }[];
}

export function CreatorFilters({ skillCategories, prefectures }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const isFavOnly = searchParams.get("fav") === "1";

  const toggleFav = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isFavOnly) {
      params.delete("fav");
    } else {
      params.set("fav", "1");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectClass =
    "px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent " +
    "transition-colors";

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* キーワード検索 */}
      <input
        type="text"
        placeholder="名前・機材・自己PRで検索..."
        defaultValue={searchParams.get("q") || ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateParam("q", (e.target as HTMLInputElement).value);
          }
        }}
        className={`${selectClass} w-64`}
      />

      {/* エリア */}
      <select
        value={searchParams.get("prefecture") || ""}
        onChange={(e) => updateParam("prefecture", e.target.value)}
        className={selectClass}
      >
        <option value="">全エリア</option>
        {prefectures.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}（{p.count}）
          </option>
        ))}
      </select>

      {/* スキル */}
      <select
        value={searchParams.get("skill") || ""}
        onChange={(e) => updateParam("skill", e.target.value)}
        className={selectClass}
      >
        <option value="">全スキル</option>
        {skillCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* 単価帯 */}
      <select
        value={searchParams.get("fee") || ""}
        onChange={(e) => updateParam("fee", e.target.value)}
        className={selectClass}
      >
        <option value="">全単価帯</option>
        <option value="~20000">~¥20,000</option>
        <option value="20000~40000">¥20,000~¥40,000</option>
        <option value="40000~60000">¥40,000~¥60,000</option>
        <option value="60000~">¥60,000~</option>
      </select>

      {/* ソート */}
      <select
        value={searchParams.get("sort") || "newest"}
        onChange={(e) => updateParam("sort", e.target.value)}
        className={selectClass}
      >
        <option value="newest">新着順</option>
        <option value="name">名前順</option>
        <option value="rate_asc">単価 安い順</option>
        <option value="rate_desc">単価 高い順</option>
        <option value="exp_desc">経験年数 多い順</option>
      </select>

      {/* お気に入りのみ */}
      <button
        onClick={toggleFav}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
          isFavOnly
            ? "bg-amber-50 border-amber-300 text-amber-700"
            : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
        }`}
      >
        <Star
          style={{ width: "0.875rem", height: "0.875rem" }}
          className={isFavOnly ? "fill-amber-400 text-amber-400" : ""}
        />
        お気に入りのみ
      </button>
    </div>
  );
}
