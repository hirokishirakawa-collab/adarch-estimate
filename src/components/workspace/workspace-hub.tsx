"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import {
  NAVIGATION_GROUPS,
  type NavigationGroup,
  type NavigationItem,
} from "@/lib/navigation/catalog";
import { AiWorkButton } from "./ai-work-button";

export function WorkspaceHub({
  group,
  items,
  children,
}: {
  group: NavigationGroup;
  items: NavigationItem[];
  children?: React.ReactNode;
}) {
  const definition = NAVIGATION_GROUPS.find((g) => g.id === group)!;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("purpose");
  const visible = useMemo(() => {
    const words = query
      .trim()
      .normalize("NFKC")
      .toLocaleLowerCase("ja")
      .split(/\s+/)
      .filter(Boolean);
    const result = items.filter(
      (i) =>
        i.href !== definition.href &&
        words.every((w) =>
          [i.label, i.section, ...i.aliases]
            .join(" ")
            .normalize("NFKC")
            .toLocaleLowerCase("ja")
            .includes(w),
        ),
    );
    return sort === "name"
      ? result.sort((a, b) => a.label.localeCompare(b.label, "ja"))
      : result;
  }, [items, query, sort, definition.href]);
  const sections =
    sort === "name" ? ["名前順"] : [...new Set(visible.map((i) => i.section))];
  return (
    <div className="os-page">
      <div className="os-page-head">
        <div>
          <h1>{definition.label}</h1>
          <p className="os-description">{definition.description}</p>
        </div>
        <AiWorkButton />
      </div>
      {children}
      <div className="os-hub-toolbar">
        <label className="os-search-field">
          <Search size={17} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前・目的から探す"
            aria-label={`${definition.label}の機能を検索`}
          />
        </label>
        <label className="os-sort">
          並び順
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="purpose">目的別</option>
            <option value="name">名前順</option>
          </select>
        </label>
      </div>
      {visible.length === 0 && (
        <p className="os-empty" role="status">
          該当する機能がありません。別の言葉で検索してください。
        </p>
      )}
      <div className="os-hub-sections">
        {sections.map((section) => (
          <section key={section}>
            <h2>{section}</h2>
            <div className="os-tool-links">
              {visible
                .filter((i) => sort === "name" || i.section === section)
                .map((item) => {
                  const body = (
                    <>
                      <span>{item.label}</span>
                      {item.external ? (
                        <ArrowUpRight size={16} aria-hidden />
                      ) : (
                        <ArrowRight size={16} aria-hidden />
                      )}
                    </>
                  );
                  return item.external ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {body}
                    </a>
                  ) : (
                    <Link key={item.href} href={item.href}>
                      {body}
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      <p className="os-footnote">
        各画面からも、同じ顧客・案件・資料の続きを開けます。
      </p>
    </div>
  );
}
