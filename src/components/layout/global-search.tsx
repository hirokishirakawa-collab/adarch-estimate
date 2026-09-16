"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { searchNavigation } from "@/lib/navigation/catalog";
import type { UserRole } from "@/types/roles";

type SearchResult = {
  id: string;
  title: string;
  href: string;
  source?: string;
};
type ResponseData = {
  customers?: { id: string; name: string }[];
  projects?: { id: string; title: string }[];
  deals?: { id: string; title: string }[];
  library?: SearchResult[];
};
type Props = {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  enabledFeatures?: string[];
};

export function GlobalSearch(props: Props) {
  return props.open ? <SearchDialog {...props} /> : null;
}

function SearchDialog({ onClose, role, enabledFeatures = [] }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<{
    query: string;
    data?: ResponseData;
    error?: string;
  } | null>(null);
  const q = query.trim();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok)
          throw new Error(
            "検索できませんでした。時間をおいて再度お試しください。",
          );
        const data: ResponseData = await res.json();
        if (!controller.signal.aborted) setResponse({ query: q, data });
      } catch (error) {
        if (!controller.signal.aborted)
          setResponse({
            query: q,
            error:
              error instanceof Error ? error.message : "検索できませんでした。",
          });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);
  const current = response?.query === q ? response : null;
  const data = current?.data;
  const groups = [
    {
      title: "顧客",
      rows: (data?.customers ?? []).map((r) => ({
        ...r,
        title: r.name,
        href: `/dashboard/customers/${r.id}`,
      })),
    },
    {
      title: "商談",
      rows: (data?.deals ?? []).map((r) => ({
        ...r,
        href: `/dashboard/deals/${r.id}`,
      })),
    },
    {
      title: "案件",
      rows: (data?.projects ?? []).map((r) => ({
        ...r,
        href: `/dashboard/projects/${r.id}`,
      })),
    },
    { title: "資料・事例・手順", rows: data?.library ?? [] },
  ];
  const menus = q ? searchNavigation(q, role, enabledFeatures).slice(0, 8) : [];
  return (
    <dialog
      ref={dialog}
      className="os-search-dialog"
      aria-label="OS内を検索"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="os-search-input">
        <Search size={18} aria-hidden />
        <input
          autoFocus
          aria-label="顧客・案件・資料・機能名"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="顧客・案件・資料・機能名を検索"
          maxLength={120}
        />
        <button
          className="os-icon-button"
          type="button"
          onClick={onClose}
          aria-label="検索を閉じる"
        >
          <X size={18} />
        </button>
      </div>
      <div className="os-search-results">
        {!q && (
          <p className="os-description">
            機能は旧名称でも探せます。顧客・案件・資料は2文字から検索します。
          </p>
        )}
        {menus.length > 0 && (
          <section>
            <h2>機能・画面</h2>
            {menus.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
              >
                {item.label}
                <span>{item.section}</span>
              </Link>
            ))}
          </section>
        )}
        <div role="status">
          {q.length >= 2 && !current && (
            <p className="os-description">検索中…</p>
          )}
          {current?.error && <p className="os-notice">{current.error}</p>}
          {data && !groups.some((group) => group.rows.length) && (
            <p className="os-description">
              一致する顧客・案件・資料はありません。
            </p>
          )}
          {q.length === 1 && (
            <p className="os-description">
              顧客・案件・資料は、あと1文字入力すると検索できます。
            </p>
          )}
        </div>
        {q.length >= 2 &&
          groups.map(
            (group) =>
              group.rows.length > 0 && (
                <section key={group.title}>
                  <h2>{group.title}</h2>
                  {group.rows.map((row: SearchResult) => (
                    <Link
                      key={`${row.href}:${row.id}`}
                      href={row.href}
                      onClick={onClose}
                    >
                      {row.title}
                      {row.source && <span>{row.source}</span>}
                    </Link>
                  ))}
                </section>
              ),
          )}
      </div>
      <p className="os-search-footer">
        Tabで結果へ移動・Enterで開く・Escで閉じる
      </p>
    </dialog>
  );
}
