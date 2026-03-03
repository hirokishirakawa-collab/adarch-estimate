"use client";

import { useActionState, useState, useRef } from "react";
import { createBusinessCard } from "@/lib/actions/business-card";
import { Camera, Upload, Loader2 } from "lucide-react";

function Field({
  label,
  name,
  value,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  value?: string | null;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-zinc-500 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={value ?? ""}
        required={required}
        className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
      />
    </div>
  );
}

type OcrResult = {
  companyName?: string | null;
  department?: string | null;
  title?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  email?: string | null;
  companyPhone?: string | null;
  directPhone?: string | null;
  mobilePhone?: string | null;
  fax?: string | null;
  postalCode?: string | null;
  address?: string | null;
  url?: string | null;
};

export function QuickRegisterForm() {
  const [state, formAction, isPending] = useActionState(createBusinessCard, null);
  const [ocrData, setOcrData] = useState<OcrResult | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(file: File) {
    setOcrError(null);
    setIsOcrProcessing(true);

    // プレビュー表示
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/business-cards/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "OCR処理に失敗しました");
      }

      const data = await res.json();
      setOcrData(data);
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : "OCR処理に失敗しました");
    } finally {
      setIsOcrProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 画像アップロードエリア */}
      <div className="bg-zinc-50 rounded-xl border-2 border-dashed border-zinc-300 p-6">
        <div className="text-center">
          {preview ? (
            <div className="mb-4">
              <img
                src={preview}
                alt="名刺プレビュー"
                className="max-h-48 mx-auto rounded-lg border border-zinc-200"
              />
            </div>
          ) : (
            <Camera className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          )}

          {isOcrProcessing ? (
            <div className="flex items-center justify-center gap-2 text-teal-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">AI が名刺を解析中...</span>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-500 mb-3">
                名刺の写真をアップロードするとAIが自動入力します
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                写真をアップロード
              </button>
            </>
          )}

          {ocrError && (
            <p className="text-xs text-red-500 mt-2">{ocrError}</p>
          )}
        </div>
      </div>

      {/* フォーム */}
      <form action={formAction} className="space-y-5">
        {/* 名刺画像を保存する場合 */}
        {fileInputRef.current?.files?.[0] && (
          <input type="hidden" name="cardImageFile" value="" />
        )}

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-xs font-semibold text-zinc-700">基本情報</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Field label="会社名" name="companyName" value={ocrData?.companyName} required />
            <Field label="部署" name="department" value={ocrData?.department} />
            <Field label="役職" name="title" value={ocrData?.title} />
            <div /> {/* spacer */}
            <Field label="姓" name="lastName" value={ocrData?.lastName} required />
            <Field label="名" name="firstName" value={ocrData?.firstName} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-xs font-semibold text-zinc-700">連絡先</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Field label="メールアドレス" name="email" value={ocrData?.email} type="email" />
            <Field label="会社電話" name="companyPhone" value={ocrData?.companyPhone} />
            <Field label="直通電話" name="directPhone" value={ocrData?.directPhone} />
            <Field label="携帯電話" name="mobilePhone" value={ocrData?.mobilePhone} />
            <Field label="FAX" name="fax" value={ocrData?.fax} />
            <Field label="URL" name="url" value={ocrData?.url} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-xs font-semibold text-zinc-700">住所</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Field label="郵便番号" name="postalCode" value={ocrData?.postalCode} />
            <Field label="都道府県" name="prefecture" />
            <div className="col-span-2">
              <Field label="住所" name="address" value={ocrData?.address} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="text-xs font-semibold text-zinc-700">分類</h3>
          </div>
          <div className="p-4 space-y-3">
            <Field label="タグ（カンマ区切り）" name="tags" />
            <div className="flex flex-wrap gap-4">
              {[
                { name: "wantsCollab", label: "コラボ希望" },
                { name: "isOrdered", label: "受注済み" },
                { name: "isCompetitor", label: "競合" },
                { name: "isCreator", label: "クリエイター" },
              ].map((opt) => (
                <label key={opt.name} className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer">
                  <input
                    type="checkbox"
                    name={opt.name}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {state?.error && (
          <p className="text-xs text-red-500">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full px-4 py-2.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "登録中..." : "名刺を登録"}
        </button>
      </form>
    </div>
  );
}
