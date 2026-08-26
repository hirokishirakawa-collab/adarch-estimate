"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Download, FileSpreadsheet, X, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------
// AIに書き出させるときの指示文。
//   OSの外にあるリスト（名刺・スプレッドシート・メール）を Gemini / ChatGPT / Claude に渡し、
//   テンプレートと同じ8列のCSVで返させる。列の並びは /api/leads/import/template と同一。
// ---------------------------------------------------------------
const AI_CSV_PROMPT = [
  "あなたは営業リストを整理するアシスタントです。",
  "この後に貼る私の資料（名刺の一覧・表・メールなど）から会社を抜き出し、",
  "次の8列のCSVだけを返してください。1行目は必ずこのヘッダーにし、説明文やコードブロック記号は付けないでください。",
  "",
  "会社名,住所,電話番号,WebサイトURL,業種,エリア,メモ,担当者名",
  "",
  "ルール:",
  "- 会社名は必須。分からない列は空のままにする（推測で埋めない）",
  "- 同じ会社は1行にまとめる",
  "- 住所や社名にカンマが含まれる場合はその項目を\"で囲む",
  "- エリアは都道府県名、業種は短い一般名（例: 飲食・宿泊 / 建設・リフォーム / 医療・クリニック）",
  "- 金額・見積額は書かない",
  "",
  "以下が資料です:",
].join("\n");

export function LeadCsvImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AI_CSV_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* クリップボード不可の環境では何もしない */
    }
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) {
      alert("CSVファイルのみ対応しています");
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const data: ImportResult = await res.json();
      setResult(data);

      if (data.imported > 0) {
        router.refresh();
      }
    } catch {
      setResult({
        imported: 0,
        skipped: 0,
        errors: ["通信エラーが発生しました"],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        CSVインポート
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 animate-in fade-in-0"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="relative z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-5 animate-in fade-in-0 zoom-in-95 mx-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-zinc-900">
                  CSVインポート
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Template download */}
            <div className="bg-zinc-50 rounded-lg px-4 py-3">
              <p className="text-xs text-zinc-600 mb-2">
                インポート用のCSVテンプレートをダウンロードして、データを入力してください。
              </p>
              <a
                href="/api/leads/import/template"
                download
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                テンプレートをダウンロード
              </a>
            </div>

            {/* AIに書き出させる */}
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
              <p className="text-xs text-zinc-700 mb-2 leading-relaxed">
                手元のリスト（名刺・表・メール）を Gemini / ChatGPT / Claude に渡して、
                この形のCSVを書かせることもできます。返ってきたものを .csv で保存して上に入れてください。
              </p>
              <button
                type="button"
                onClick={copyPrompt}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:text-violet-800 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {copied ? "コピーしました" : "AI用の指示文をコピー"}
              </button>
            </div>

            {/* File upload area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors
                ${
                  dragOver
                    ? "border-blue-400 bg-blue-50"
                    : file
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }
              `}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    {file.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setResult(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="p-0.5 rounded hover:bg-emerald-100"
                  >
                    <X className="w-3.5 h-3.5 text-emerald-500" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="text-sm text-zinc-500">
                    CSVファイルをドラッグ&ドロップ
                  </p>
                  <p className="text-xs text-zinc-400">
                    またはクリックしてファイルを選択
                  </p>
                </div>
              )}
            </div>

            {/* Result display */}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  {result.imported > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      {result.imported}件インポート
                    </span>
                  )}
                  {result.skipped > 0 && (
                    <span className="text-zinc-500">
                      {result.skipped}件スキップ（重複）
                    </span>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="bg-red-50 rounded-lg px-3 py-2 max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-red-600 py-0.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    インポート中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    インポート
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
