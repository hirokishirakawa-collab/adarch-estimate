"use client";

import { useState } from "react";
import { Copy, Check, FileText } from "lucide-react";
import { WikiArticleContent } from "@/components/wiki/wiki-article-content";

export interface KitMaterial {
  id: string;
  label: string;
  note: string;
  version: string;
  body: string;
  downloadHref: string;
}

export function BrandKitTabs({ materials }: { materials: KitMaterial[] }) {
  const [active, setActive] = useState(materials[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const current = materials.find((m) => m.id === active) ?? materials[0];
  if (!current) return null;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(current.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("コピーできない場合は、この文をすべて選択してコピーしてください", current.body);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* タブ */}
      <div className="flex items-center gap-1 px-3 pt-3 border-b border-zinc-200 overflow-x-auto">
        {materials.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setActive(m.id);
              setCopied(false);
            }}
            className={[
              "px-3 py-2 text-xs font-bold rounded-t-lg whitespace-nowrap transition-colors border-b-2",
              m.id === active
                ? "text-zinc-900 border-orange-500"
                : "text-zinc-500 border-transparent hover:text-zinc-800",
            ].join(" ")}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 操作行 */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="text-xs text-zinc-600">
          <span className="font-bold text-zinc-800">{current.version}</span>
          <span className="mx-2 text-zinc-300">|</span>
          {current.note}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={current.downloadHref}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-zinc-300 text-zinc-700 hover:bg-white transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            .md をダウンロード
          </a>
          <button
            onClick={copyAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-orange-500 text-zinc-900 hover:bg-orange-600 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "コピーしました" : "全文をコピー（AIに貼る）"}
          </button>
        </div>
      </div>

      {/* 本文 */}
      <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
        <WikiArticleContent body={current.body} />
      </div>
    </div>
  );
}
