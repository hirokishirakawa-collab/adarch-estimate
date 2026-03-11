"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, FileVideo, Loader2, ExternalLink, Film } from "lucide-react";

const ACCEPTED_FORMATS = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const STEPS = [
  "動画をアップロード中...",
  "シーンを検出中...",
  "音声を書き起こし中...",
  "カット表を生成中...",
] as const;

export function CutSheetPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((f: File): boolean => {
    if (!ACCEPTED_FORMATS.includes(f.type)) {
      toast.error("対応していないファイル形式です。MP4, MOV, WebM のみ対応しています。");
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("ファイルサイズが大きすぎます。500MB以下のファイルを選択してください。");
      return false;
    }
    return true;
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      if (validateFile(f)) {
        setFile(f);
        setSheetsUrl(null);
      }
    },
    [validateFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setSheetsUrl(null);
    setCurrentStep(0);

    try {
      const formData = new FormData();
      formData.append("video", file);

      const res = await fetch("/api/cutsheet", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `アップロードに失敗しました (${res.status})`);
      }

      const data = await res.json();

      if (data.url) {
        setSheetsUrl(data.url);
        toast.success("カット表の生成が完了しました！");
      } else {
        throw new Error("Google Sheets の URL が取得できませんでした。");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "エラーが発生しました。";
      toast.error(message);
    } finally {
      setIsUploading(false);
      setCurrentStep(-1);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Film className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              動画カット表ツール
            </h1>
          </div>
          <p className="text-gray-500">
            動画をアップロードすると、シーン検出・音声書き起こしを行い、Google
            Sheets にカット表を自動生成します。
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : file
                  ? "border-green-300 bg-green-50"
                  : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
              onChange={handleInputChange}
              className="hidden"
            />

            {file ? (
              <>
                <FileVideo className="mb-3 h-12 w-12 text-green-500" />
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  クリックしてファイルを変更
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-3 h-12 w-12 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  ドラッグ＆ドロップ、またはクリックしてファイルを選択
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  MP4, MOV, WebM（最大 500MB）
                </p>
              </>
            )}
          </div>

          {/* Progress Steps */}
          {isUploading && currentStep >= 0 && (
            <div className="mt-6 space-y-3">
              {STEPS.map((label, index) => (
                <div key={index} className="flex items-center gap-3">
                  {index < currentStep ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                      ✓
                    </div>
                  ) : index === currentStep ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-400">
                      {index + 1}
                    </div>
                  )}
                  <span
                    className={`text-sm ${
                      index <= currentStep
                        ? "font-medium text-gray-900"
                        : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          {!sheetsUrl && (
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="mt-6 w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  アップロードしてカット表を生成
                </>
              )}
            </Button>
          )}

          {/* Result Link */}
          {sheetsUrl && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <p className="mb-3 text-sm font-medium text-green-800">
                カット表の生成が完了しました！
              </p>
              <a
                href={sheetsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <ExternalLink className="h-4 w-4" />
                Google Sheets で開く
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
