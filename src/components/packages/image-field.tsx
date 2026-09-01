"use client";

// サムネイル（参考イメージ）: アップロード or AIで生成 → プレビュー → hidden imageUrl
import { useRef, useState } from "react";
import { ImageIcon, Loader2, Sparkles, Trash2, Upload } from "lucide-react";

export function PackageImageField({
  value,
  onChange,
  context,
}: {
  value: string;
  onChange: (url: string) => void;
  /** AI生成のプロンプト材料（フォームの現在値） */
  context: { name: string; tagline: string; category: string; painPoints: string; summary: string };
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "generate" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy("upload");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/packages/image", { method: "POST", body: fd });
      const d = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? "失敗しました");
      onChange(d.url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function generate() {
    if (!context.name.trim()) {
      setMsg("パッケージ名を先に入れてください（それをもとに生成します）");
      return;
    }
    setBusy("generate");
    setMsg(null);
    try {
      const res = await fetch("/api/packages/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, ...context }),
      });
      const d = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? "生成に失敗しました");
      onChange(d.url);
      setMsg("参考イメージを1枚作りました。気に入らなければもう一度、または画像を選んで差し替えられます");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <input type="hidden" name="imageUrl" value={value} />
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-64 shrink-0 aspect-[3/2] rounded-lg bg-zinc-100 overflow-hidden flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-zinc-300" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-xs text-zinc-600">一覧のカード・詳細・お客様向けページ・資料PDFの上に出ます（横3:2が収まりが良いです）。</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50">
              {busy === "upload" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              画像を選ぶ
            </button>
            <button type="button" onClick={generate} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
              {busy === "generate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {busy === "generate" ? "生成中（30秒ほど）…" : "AIで参考イメージを作る"}
            </button>
            {value && (
              <button type="button" onClick={() => onChange("")} disabled={!!busy} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />外す
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {msg && <p className="text-[11px] text-zinc-600">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
