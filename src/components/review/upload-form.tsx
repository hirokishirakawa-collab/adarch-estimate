"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, Film, Loader2 } from "lucide-react";
import { createReview } from "@/lib/actions/review";

export function UploadForm() {
  const [state, action, isPending] = useActionState(createReview, null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          タイトル
        </label>
        <input
          name="title"
          type="text"
          required
          placeholder="例: ○○商品CM 第2稿チェック"
          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white/90 text-sm placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white/70 mb-1.5">
          説明（任意）
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder="修正内容のメモなど"
          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white/90 text-sm placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before Video */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            修正前の動画
          </label>
          <input
            ref={beforeRef}
            type="file"
            name="beforeVideo"
            accept="video/*"
            required
            onChange={(e) => setBeforeFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => beforeRef.current?.click()}
            className="w-full h-36 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/10 rounded-xl hover:border-amber-500/30 hover:bg-amber-500/[0.03] transition-all cursor-pointer"
          >
            {beforeFile ? (
              <>
                <Film className="w-8 h-8 text-amber-500/60" />
                <span className="text-sm text-white/70 truncate max-w-[90%]">
                  {beforeFile.name}
                </span>
                <span className="text-xs text-white/40">
                  {(beforeFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-white/20" />
                <span className="text-sm text-white/40">
                  ドラッグ&ドロップ または クリック
                </span>
              </>
            )}
          </button>
        </div>

        {/* After Video */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            修正後の動画
          </label>
          <input
            ref={afterRef}
            type="file"
            name="afterVideo"
            accept="video/*"
            required
            onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => afterRef.current?.click()}
            className="w-full h-36 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/10 rounded-xl hover:border-amber-500/30 hover:bg-amber-500/[0.03] transition-all cursor-pointer"
          >
            {afterFile ? (
              <>
                <Film className="w-8 h-8 text-emerald-500/60" />
                <span className="text-sm text-white/70 truncate max-w-[90%]">
                  {afterFile.name}
                </span>
                <span className="text-xs text-white/40">
                  {(afterFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-white/20" />
                <span className="text-sm text-white/40">
                  ドラッグ&ドロップ または クリック
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || !beforeFile || !afterFile}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold text-sm hover:from-amber-500 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            アップロード中...
          </>
        ) : (
          "解析スタート"
        )}
      </button>
    </form>
  );
}
