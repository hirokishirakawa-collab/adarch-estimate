"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, Film, Loader2, CheckCircle2 } from "lucide-react";
import { createReview } from "@/lib/actions/review";

type UploadState = "idle" | "uploading" | "done" | "error";

export function UploadForm() {
  const [state, action, isPending] = useActionState(createReview, null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePath, setBeforePath] = useState<string | null>(null);
  const [afterPath, setAfterPath] = useState<string | null>(null);
  const [beforeUpload, setBeforeUpload] = useState<UploadState>("idle");
  const [afterUpload, setAfterUpload] = useState<UploadState>("idle");
  const [beforeProgress, setBeforeProgress] = useState(0);
  const [afterProgress, setAfterProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (
    file: File,
    prefix: string,
    setProgress: (p: number) => void,
    setUploadState: (s: UploadState) => void,
    setPath: (p: string) => void
  ) => {
    setUploadState("uploading");
    setProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prefix", prefix);

      // Use XMLHttpRequest for progress tracking
      const result = await new Promise<{ path: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/review/upload");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(JSON.parse(xhr.responseText)?.error || "アップロード失敗"));
          }
        };

        xhr.onerror = () => reject(new Error("ネットワークエラー"));
        xhr.send(formData);
      });

      setPath(result.path);
      setUploadState("done");
      setProgress(100);
    } catch (e) {
      setUploadState("error");
      setUploadError(e instanceof Error ? e.message : "アップロードに失敗しました");
    }
  };

  const handleBeforeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setBeforeFile(file);
    if (file) {
      uploadFile(file, "before/", setBeforeProgress, setBeforeUpload, setBeforePath);
    }
  };

  const handleAfterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAfterFile(file);
    if (file) {
      uploadFile(file, "after/", setAfterProgress, setAfterUpload, setAfterPath);
    }
  };

  const canSubmit = beforeUpload === "done" && afterUpload === "done" && !isPending;

  return (
    <form action={action} className="space-y-6">
      {/* Hidden fields for file paths */}
      <input type="hidden" name="beforePath" value={beforePath || ""} />
      <input type="hidden" name="afterPath" value={afterPath || ""} />
      <input type="hidden" name="beforeFileName" value={beforeFile?.name || ""} />
      <input type="hidden" name="afterFileName" value={afterFile?.name || ""} />

      {(state?.error || uploadError) && (
        <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {state?.error || uploadError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          タイトル
        </label>
        <input
          name="title"
          type="text"
          required
          placeholder="例: ○○商品CM 第2稿チェック"
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          説明（任意）
        </label>
        <textarea
          name="description"
          rows={2}
          placeholder="修正内容のメモなど"
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before Video */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            修正前の動画
          </label>
          <input
            ref={beforeRef}
            type="file"
            accept="video/*"
            onChange={handleBeforeChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => beforeRef.current?.click()}
            disabled={beforeUpload === "uploading"}
            className="w-full h-40 flex flex-col items-center justify-center gap-2.5 border-2 border-dashed border-zinc-600 rounded-xl bg-zinc-800/50 hover:border-amber-500 hover:bg-zinc-800 transition-all cursor-pointer disabled:cursor-wait"
          >
            {beforeUpload === "uploading" ? (
              <>
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="text-sm text-amber-400 font-medium">
                  アップロード中... {beforeProgress}%
                </span>
                <div className="w-3/4 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${beforeProgress}%` }}
                  />
                </div>
              </>
            ) : beforeUpload === "done" ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span className="text-sm text-white font-medium truncate max-w-[90%]">
                  {beforeFile?.name}
                </span>
                <span className="text-xs text-zinc-500">
                  {beforeFile ? (beforeFile.size / 1024 / 1024).toFixed(1) : 0} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-zinc-500" />
                <span className="text-sm text-zinc-400">
                  動画をドロップ または クリック
                </span>
              </>
            )}
          </button>
        </div>

        {/* After Video */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            修正後の動画
          </label>
          <input
            ref={afterRef}
            type="file"
            accept="video/*"
            onChange={handleAfterChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => afterRef.current?.click()}
            disabled={afterUpload === "uploading"}
            className="w-full h-40 flex flex-col items-center justify-center gap-2.5 border-2 border-dashed border-zinc-600 rounded-xl bg-zinc-800/50 hover:border-emerald-500 hover:bg-zinc-800 transition-all cursor-pointer disabled:cursor-wait"
          >
            {afterUpload === "uploading" ? (
              <>
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <span className="text-sm text-emerald-400 font-medium">
                  アップロード中... {afterProgress}%
                </span>
                <div className="w-3/4 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${afterProgress}%` }}
                  />
                </div>
              </>
            ) : afterUpload === "done" ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span className="text-sm text-white font-medium truncate max-w-[90%]">
                  {afterFile?.name}
                </span>
                <span className="text-xs text-zinc-500">
                  {afterFile ? (afterFile.size / 1024 / 1024).toFixed(1) : 0} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-zinc-500" />
                <span className="text-sm text-zinc-400">
                  動画をドロップ または クリック
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold text-sm hover:from-amber-500 hover:to-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            作成中...
          </>
        ) : (
          "解析スタート"
        )}
      </button>
    </form>
  );
}
