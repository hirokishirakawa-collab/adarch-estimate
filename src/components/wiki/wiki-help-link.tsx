"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

interface Props {
  /** Wiki検索クエリ（記事タイトルの一部） */
  query: string;
  /** 表示ラベル（省略時はqueryを使用） */
  label?: string;
}

export function WikiHelpLink({ query, label }: Props) {
  return (
    <Link
      href={`/dashboard/wiki?q=${encodeURIComponent(query)}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors font-medium"
    >
      <BookOpen className="w-3 h-3" />
      {label || `${query}の使い方`}
    </Link>
  );
}
