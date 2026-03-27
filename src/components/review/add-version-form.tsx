"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Upload, Film, Loader2, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { addVersion } from "@/lib/actions/review";

type UploadState = "idle" | "uploading" | "done" | "error";

interface Props {
  projectId: string;
  currentVersion: number;
}

export function AddVersionForm({ projectId, currentVersion }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, isPending] = useActionState(addVersion, null);
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (!f) return;

    setUploadState("uploading");
    setProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("prefix", "after/");

      const result = await new Promise<{ path: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/review/upload");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error("アップロード失敗"));
        };
        xhr.onerror = () => reject(new Error("ネットワークエラー"));
        xhr.send(formData);
      });

      setFilePath(result.path);
      setUploadState("done");
      setProgress(100);
    } catch (e) {
      setUploadState("error");
      setUploadError(e instanceof Error ? e.message : "エラー");
    }
  };

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors rounded-xl"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
        <Plus className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-zinc-300">
          v{currentVersion + 1} を追加
        </span>
      </button>

      {isOpen && (
        <form action={action} className="px-4 pb-4 space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="afterPath" value={filePath || ""} />
          <input type="hidden" name="afterFileName" value={file?.name || ""} />

          {(state?.error || uploadError) && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
              {state?.error || uploadError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              修正内容メモ（任意）
            </label>
            <input
              name="description"
              type="text"
              placeholder="例: テロップ修正、色味調整"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              修正後の動画
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadState === "uploading"}
              className="w-full h-28 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-600 rounded-xl bg-zinc-800/50 hover:border-emerald-500 hover:bg-zinc-800 transition-all cursor-pointer disabled:cursor-wait"
            >
              {uploadState === "uploading" ? (
                <>
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  <span className="text-sm text-emerald-400">{progress}%</span>
                  <div className="w-1/2 h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </>
              ) : uploadState === "done" ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <span className="text-sm text-white font-medium truncate max-w-[90%]">{file?.name}</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-zinc-500" />
                  <span className="text-sm text-zinc-400">動画を選択</span>
                </>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={uploadState !== "done" || isPending}
            className="w-full py-2.5 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/20 font-semibold text-sm hover:bg-amber-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            v{currentVersion + 1} を追加して解析
          </button>
        </form>
      )}
    </div>
  );
}
