"use client";

// 公開ページ（お客様向け）のURLを見せる・コピーする・開く
import { useState } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";

export function PackageShareLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* noop */
    }
  }
  return (
    <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50/60 px-3 py-2.5 flex flex-wrap items-center gap-2">
      <Link2 className="w-3.5 h-3.5 text-orange-600 shrink-0" />
      <span className="text-[11px] font-bold text-orange-800">お客様向け公開ページ</span>
      <code className="text-[11px] text-zinc-700 bg-white border border-zinc-200 rounded px-2 py-1 truncate max-w-full sm:max-w-md">{url}</code>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded bg-[#1F3A5F] text-white hover:bg-[#16304f]">
        {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {done ? "コピーしました" : "URLをコピー"}
      </button>
      <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50">
        <ExternalLink className="w-3 h-3" />開く
      </a>
      <span className="text-[10.5px] text-zinc-500 w-full">メール・LINEにそのまま貼れます。ログイン不要。差出人はあなたの会社名で出ます。</span>
    </div>
  );
}
