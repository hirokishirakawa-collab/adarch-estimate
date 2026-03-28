"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, Film, Loader2, CheckCircle2, X, UserPlus } from "lucide-react";
import { createReview } from "@/lib/actions/review";

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

interface UploadResult {
  uploadId: string;
  playbackId: string | null;
  assetId: string | null;
}

interface ProjectOption {
  id: string;
  title: string;
  customerName: string | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface UploadFormProps {
  projects: ProjectOption[];
  users: UserOption[];
}

export function UploadForm({ projects, users }: UploadFormProps) {
  const [state, action, isPending] = useActionState(createReview, null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforeResult, setBeforeResult] = useState<UploadResult | null>(null);
  const [afterResult, setAfterResult] = useState<UploadResult | null>(null);
  const [beforeUpload, setBeforeUpload] = useState<UploadState>("idle");
  const [afterUpload, setAfterUpload] = useState<UploadState>("idle");
  const [beforeProgress, setBeforeProgress] = useState(0);
  const [afterProgress, setAfterProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const uploadToMux = async (
    file: File,
    setProgress: (p: number) => void,
    setState: (s: UploadState) => void,
    setResult: (r: UploadResult) => void
  ) => {
    setState("uploading");
    setProgress(0);
    setUploadError(null);

    try {
      // 1. Get Direct Upload URL from our API
      const res = await fetch("/api/review/upload", { method: "POST" });
      const { uploadId, uploadUrl, error } = await res.json();
      if (error) throw new Error(error);

      // 2. Upload directly to Mux via XHR (for progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };

        xhr.onerror = () => reject(new Error("ネットワークエラー"));
        xhr.send(file);
      });

      // 3. Poll for asset readiness
      setState("processing");
      setProgress(100);

      let result: UploadResult = { uploadId, playbackId: null, assetId: null };
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`/api/review/upload?uploadId=${uploadId}`);
        const data = await statusRes.json();

        if (data.playbackId) {
          result = { uploadId, playbackId: data.playbackId, assetId: data.assetId };
          break;
        }
        if (data.status === "errored") throw new Error("Mux エンコード失敗");
      }

      if (!result.playbackId) throw new Error("エンコードがタイムアウトしました");

      setResult(result);
      setState("done");
    } catch (e) {
      setState("error");
      setUploadError(e instanceof Error ? e.message : "アップロードに失敗しました");
    }
  };

  const handleBeforeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setBeforeFile(file);
    if (file) uploadToMux(file, setBeforeProgress, setBeforeUpload, setBeforeResult);
  };

  const handleAfterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAfterFile(file);
    if (file) uploadToMux(file, setAfterProgress, setAfterUpload, setAfterResult);
  };

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<UserOption[]>([]);
  const canSubmit = beforeUpload === "done" && afterUpload === "done" && !!selectedProjectId && !isPending;

  const toggleMember = (user: UserOption) => {
    setSelectedMembers((prev) =>
      prev.some((m) => m.id === user.id)
        ? prev.filter((m) => m.id !== user.id)
        : [...prev, user]
    );
  };

  return (
    <form action={action} className="space-y-6">
      {/* Hidden fields */}
      <input type="hidden" name="beforePath" value={beforeResult?.playbackId || ""} />
      <input type="hidden" name="afterPath" value={afterResult?.playbackId || ""} />
      <input type="hidden" name="beforeFileName" value={beforeFile?.name || ""} />
      <input type="hidden" name="afterFileName" value={afterFile?.name || ""} />
      <input type="hidden" name="linkedProjectId" value={selectedProjectId} />
      <input type="hidden" name="memberIds" value={selectedMembers.map((m) => m.id).join(",")} />

      {(state?.error || uploadError) && (
        <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {state?.error || uploadError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">プロジェクト</label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          required
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-colors appearance-none"
        >
          <option value="" className="text-zinc-600">プロジェクトを選択...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id} className="text-white">
              {p.title}{p.customerName ? ` (${p.customerName})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">タイトル</label>
        <input
          name="title"
          type="text"
          required
          placeholder="例: ○○商品CM 第2稿チェック"
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">説明（任意）</label>
        <textarea
          name="description"
          rows={2}
          placeholder="修正内容のメモなど"
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* メンバー選択 */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          <UserPlus className="w-4 h-4 inline mr-1.5" />
          アクセスメンバー
        </label>
        <p className="text-xs text-zinc-600 mb-2">このチェックにアクセスできるメンバーを選択（あなたは自動的に追加されます）</p>

        {/* 選択済みメンバー */}
        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedMembers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20"
              >
                {m.name}
                <button
                  type="button"
                  onClick={() => toggleMember(m)}
                  className="hover:text-amber-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ユーザー候補リスト */}
        <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/50 divide-y divide-zinc-800">
          {users.map((user) => {
            const isSelected = selectedMembers.some((m) => m.id === user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleMember(user)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-amber-500/8 text-amber-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? "bg-amber-500 border-amber-500"
                    : "border-zinc-600"
                }`}>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                </div>
                <span className="truncate">{user.name}</span>
                <span className="text-xs text-zinc-600 truncate ml-auto">{user.email}</span>
              </button>
            );
          })}
          {users.length === 0 && (
            <p className="px-3 py-4 text-xs text-zinc-600 text-center">他のユーザーがいません</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VideoDropZone
          label="修正前の動画"
          file={beforeFile}
          uploadState={beforeUpload}
          progress={beforeProgress}
          accentColor="amber"
          inputRef={beforeRef}
          onChange={handleBeforeChange}
        />
        <VideoDropZone
          label="修正後の動画"
          file={afterFile}
          uploadState={afterUpload}
          progress={afterProgress}
          accentColor="emerald"
          inputRef={afterRef}
          onChange={handleAfterChange}
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> 作成中...</>
        ) : (
          "解析スタート"
        )}
      </button>
    </form>
  );
}

function VideoDropZone({
  label,
  file,
  uploadState,
  progress,
  accentColor,
  inputRef,
  onChange,
}: {
  label: string;
  file: File | null;
  uploadState: UploadState;
  progress: number;
  accentColor: "amber" | "emerald";
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const colors = {
    amber: { spinner: "text-amber-500", text: "text-amber-400", bar: "bg-amber-500", border: "hover:border-amber-500" },
    emerald: { spinner: "text-emerald-500", text: "text-emerald-400", bar: "bg-emerald-500", border: "hover:border-emerald-500" },
  }[accentColor];

  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
      <input ref={inputRef} type="file" accept="video/*" onChange={onChange} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploadState === "uploading" || uploadState === "processing"}
        className={`w-full h-40 flex flex-col items-center justify-center gap-2.5 border-2 border-dashed border-zinc-600 rounded-xl bg-zinc-800/50 ${colors.border} hover:bg-zinc-800 transition-all cursor-pointer disabled:cursor-wait`}
      >
        {uploadState === "uploading" ? (
          <>
            <Loader2 className={`w-8 h-8 ${colors.spinner} animate-spin`} />
            <span className={`text-sm ${colors.text} font-medium`}>アップロード中... {progress}%</span>
            <div className="w-3/4 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div className={`h-full ${colors.bar} rounded-full transition-all duration-300`} style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : uploadState === "processing" ? (
          <>
            <Loader2 className={`w-8 h-8 ${colors.spinner} animate-spin`} />
            <span className={`text-sm ${colors.text} font-medium`}>エンコード中...</span>
          </>
        ) : uploadState === "done" ? (
          <>
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <span className="text-sm text-white font-medium truncate max-w-[90%]">{file?.name}</span>
            <span className="text-xs text-zinc-500">{file ? (file.size / 1024 / 1024).toFixed(1) : 0} MB</span>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-zinc-500" />
            <span className="text-sm text-zinc-400">動画をドロップ または クリック</span>
          </>
        )}
      </button>
    </div>
  );
}
