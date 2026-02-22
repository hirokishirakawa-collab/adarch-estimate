"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2, Upload, X, FileText } from "lucide-react";
import { MEDIA_TYPE_OPTIONS } from "@/lib/constants/media";

type Customer = { id: string; name: string };

interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  customers: Customer[];
}

export function MediaRequestForm({ action, customers }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
  }
  function clearFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 " +
    "bg-white text-zinc-900";

  return (
    <form action={formAction} className="space-y-5 max-w-xl" encType="multipart/form-data">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── 媒体種別 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          媒体種別<span className="text-red-500 ml-0.5">*</span>
        </label>
        <select name="mediaType" required className={inputCls}>
          <option value="">— 選択してください —</option>
          {MEDIA_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── 媒体名 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          媒体名<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="text" name="mediaName"
          placeholder="例: TVer 15秒スポット広告"
          required maxLength={200}
          className={inputCls}
        />
      </div>

      {/* ── 顧客 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          顧客
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
        </label>
        <select name="customerId" className={inputCls}>
          <option value="">— 選択してください（任意）—</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ── 掲載期間 ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            掲載開始日
            <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
          </label>
          <input type="date" name="startDate" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            掲載終了日
            <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
          </label>
          <input type="date" name="endDate" className={inputCls} />
        </div>
      </div>

      {/* ── 費用・予算 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          費用・予算
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意・自由入力</span>
        </label>
        <input
          type="text" name="budget"
          placeholder="例: 30万円程度、応相談"
          maxLength={200}
          className={inputCls}
        />
      </div>

      {/* ── 依頼内容・備考 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          依頼内容・備考
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
        </label>
        <textarea
          name="description" rows={6}
          placeholder="掲載内容の詳細、ターゲット、注意事項などを記入してください"
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* ── 添付ファイル ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          添付ファイル
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">任意</span>
        </label>

        {selectedFile ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200
                          rounded-lg text-xs text-emerald-700">
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate flex-1">{selectedFile.name}</span>
            <button type="button" onClick={clearFile} className="text-zinc-400 hover:text-red-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed
                            border-zinc-200 rounded-lg cursor-pointer hover:border-amber-300
                            hover:bg-amber-50 transition-colors text-xs text-zinc-400">
            <Upload className="w-4 h-4" />
            <span>ファイルを選択</span>
            <input
              ref={fileInputRef} type="file" name="file"
              className="hidden" onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {/* ── 送信ボタン ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit" disabled={isPending}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-amber-600 text-white
                     text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-60
                     transition-colors"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          依頼を送信する
        </button>
        <a
          href="/dashboard/media"
          className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          キャンセル
        </a>
      </div>
    </form>
  );
}
