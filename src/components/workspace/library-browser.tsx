"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronDown,
  Files, Film, Images, Layers, MessagesSquare, Search,
} from "lucide-react";
import { AiWorkButton } from "./ai-work-button";
import type { LibraryHit, LibraryQuery } from "@/lib/workspace/library-search";
import styles from "./library-browser.module.css";

const categories = [
  { kind: "all", label: "すべて", icon: null },
  { kind: "material", label: "資料", icon: Files },
  { kind: "package", label: "商品・媒体", icon: Layers },
  { kind: "case", label: "営業事例", icon: MessagesSquare },
  { kind: "portfolio", label: "実績・素材", icon: Images },
  { kind: "seminar", label: "セミナー録画", icon: Film },
  { kind: "wiki", label: "手順・Wiki", icon: BookOpen },
] as const;
const sourceIcons = { material: Files, package: Layers, case: MessagesSquare, portfolio: Images, seminar: Film, wiki: BookOpen };
const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
});

export function LibraryBrowser({ input, rows, showOutreach }: {
  input: LibraryQuery;
  rows: LibraryHit[];
  showOutreach: boolean;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState({
    q: input.q ?? "", kind: input.kind ?? "all", from: input.from ?? "",
    to: input.to ?? "", sort: input.sort ?? "newest",
  });
  const [periodOpen, setPeriodOpen] = useState(Boolean(input.from || input.to));
  const [dateError, setDateError] = useState("");
  function readQuery() {
    if (!form.current) return query;
    const values = new FormData(form.current);
    return {
      q: String(values.get("q") ?? ""), kind: String(values.get("kind") ?? "all"),
      from: String(values.get("from") ?? ""), to: String(values.get("to") ?? ""),
      sort: String(values.get("sort") ?? "newest"),
    };
  }
  function search(next = readQuery()) {
    if (next.from && next.to && next.from > next.to) {
      setDateError("終了日は開始日以降を指定してください。");
      setPeriodOpen(true);
      return;
    }
    setDateError("");
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(next)) {
      const cleaned = name === "q" ? value.trim() : value;
      if (cleaned && !(name === "kind" && cleaned === "all") && !(name === "sort" && cleaned === "newest")) params.set(name, cleaned);
    }
    startTransition(() => router.push(`/dashboard/library${params.size ? `?${params}` : ""}`, { scroll: false }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = readQuery();
    setQuery(next);
    search(next);
  }
  const selectedLabel = categories.find((item) => item.kind === (input.kind || "all"))?.label ?? "すべて";
  return (
    <section className={styles.page} aria-labelledby="library-heading">
      <header className={styles.heading}>
        <div>
          <h1 id="library-heading">資料・事例を探す</h1>
          <p>提案に使う資料も、参考になる事例も。ひとつの検索で。</p>
        </div>
        <div className={styles.aiButton}>
          <AiWorkButton secondary context={{ task: `「${input.q || "提案"}」に使う資料を探す` }} />
        </div>
      </header>
      <form ref={form} action="/dashboard/library" onSubmit={submit} aria-label="資料・事例の検索条件">
        <div className={styles.search}>
          <Search size={22} strokeWidth={1.5} aria-hidden />
          <input
            type="search" name="q" aria-label="キーワード" placeholder="業種・商品・用途で検索"
            value={query.q} maxLength={120} onChange={(event) => setQuery({ ...query, q: event.target.value })}
          />
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? "検索中" : "検索"}<ArrowRight size={17} aria-hidden />
          </button>
        </div>
        <input type="hidden" name="kind" value={query.kind} />
        <div className={styles.categories} role="group" aria-label="資料の種類">
          {categories.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind} type="button" data-kind={kind} className={styles.category}
              aria-pressed={query.kind === kind} disabled={pending}
              onClick={() => { const next = { ...readQuery(), kind }; setQuery(next); search(next); }}
            >
              {Icon && <Icon size={15} strokeWidth={1.5} aria-hidden />}{label}
            </button>
          ))}
        </div>
        <div className={styles.toolbar}>
          <h2>
            {input.q?.trim() ? `「${input.q.trim()}」の検索結果` : selectedLabel === "すべて" ? "すべての種類" : selectedLabel}
            <span role="status">{pending ? "更新中…" : `表示 ${rows.length}件`}</span>
          </h2>
          <div className={styles.controls}>
            <button
              type="button" className={styles.periodToggle} aria-expanded={periodOpen} aria-controls="library-period"
              onClick={() => setPeriodOpen(!periodOpen)}
            >
              <CalendarDays size={15} aria-hidden />{input.from || input.to ? "期間を指定中" : "期間で絞る"}
              <ChevronDown size={14} aria-hidden className={periodOpen ? styles.chevronOpen : undefined} />
            </button>
            <label className={styles.sort}>
              並び順
              <select name="sort" value={query.sort} disabled={pending} onChange={(event) => {
                const next = { ...readQuery(), sort: event.target.value }; setQuery(next); search(next);
              }}>
                <option value="newest">更新が新しい順</option>
                <option value="oldest">更新が古い順</option>
                <option value="name">名前順</option>
              </select>
            </label>
          </div>
        </div>
        <div className={styles.period} id="library-period" hidden={!periodOpen}>
          <label>更新日から<input type="date" name="from" value={query.from} onChange={(event) => setQuery({ ...query, from: event.target.value })} /></label>
          <label>更新日まで<input type="date" name="to" value={query.to} onChange={(event) => setQuery({ ...query, to: event.target.value })} /></label>
          <button type="submit" disabled={pending}>適用</button>
          <button type="button" disabled={pending} onClick={() => {
            const next = { ...readQuery(), from: "", to: "" }; setQuery(next); search(next);
          }}>期間を解除</button>
          {dateError && <p role="alert" className={styles.dateError}>{dateError}</p>}
        </div>
      </form>
      <div className={styles.results} aria-busy={pending}>
        {rows.length ? rows.map((row) => {
          const Icon = sourceIcons[row.kind];
          return (
            <Link key={`${row.kind}:${row.id}`} href={row.href} className={styles.result} data-kind={row.kind}>
              <div className={styles.glyph} aria-hidden><Icon size={27} strokeWidth={1.4} /></div>
              <div className={styles.copy}>
                <div className={styles.meta}>
                  <span className={styles.source}>{row.source}</span>
                  <time dateTime={row.updatedAt}>{row.kind === "case" ? "投稿" : "更新"} {dateFormat.format(new Date(row.updatedAt))}</time>
                </div>
                <h3><span>{row.title}</span><ArrowUpRight size={15} aria-hidden /></h3>
                <p>{row.excerpt}</p>
              </div>
            </Link>
          );
        }) : (
          <div className={styles.empty}>
            <Search size={25} aria-hidden />
            <p>該当する資料がありません。別の言葉や種類で検索してください。</p>
            <Link href="/dashboard/library">検索条件を解除</Link>
          </div>
        )}
      </div>
      <p className={styles.note}>
        各種類の上位20件を表示。営業事例は投稿日、それ以外は更新日で絞ります。<br />
        他社・媒体資料の価格は卸値の場合があります。販売料金はOSの商品・プランで確認してください。
      </p>
      <nav className={styles.related} aria-label="関連する資料・事例">
        {showOutreach && <Link href="/dashboard/outreach-messages">送った営業文と結果 <ArrowUpRight size={13} aria-hidden /></Link>}
        <Link href="/dashboard/sales-approaches">アプローチ事例 <ArrowUpRight size={13} aria-hidden /></Link>
        <Link href="/dashboard/portfolio">制作実績 <ArrowUpRight size={13} aria-hidden /></Link>
        <Link href="/dashboard/seminars">録画 <ArrowUpRight size={13} aria-hidden /></Link>
      </nav>
    </section>
  );
}
