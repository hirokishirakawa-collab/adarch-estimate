"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

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
    </div>
  );
}
