"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  CheckCircle2,
  Plus,
  Rocket,
  Target,
  FileText,
  Sparkles,
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  Phone,
  MessageSquare,
  User,
  Mail,
  Calendar,
  ChevronDown,
  Upload,
  X,
  AlertCircle,
  AlertTriangle,
  Play,
  Trash2,
} from "lucide-react";

const TARGET_TYPE_LABELS: Record<string, string> = {
  BTOB: "BtoB（法人向け）",
  BTOC: "BtoC（個人・店舗向け）",
};

const SERVICE_TYPE_OPTIONS = [
  { id: "VIDEO_PRODUCTION", label: "動画制作", icon: "🎬" },
  { id: "SNS_MANAGEMENT", label: "SNS運用", icon: "📱" },
  { id: "AD_MEDIA", label: "広告媒体提案", icon: "📊" },
  { id: "FIRST_MEETING", label: "初回商談", icon: "🤝" },
] as const;

interface Template {
  id: string;
  name: string;
  companyName: string;
  senderName: string;
  targetType: string;
  serviceTypes: string[];
  pitchText: string;
  isApproved: boolean;
  branch: { name: string } | null;
}

interface TargetWithStatus {
  id: string;
  companyName: string;
  url: string;
  industry: string | null;
  area: string | null;
  phone: string | null;
  jobs: Array<{ status: string; completedAt: string | null }>;
}

export function AutoSalesRequestForm({
  templates,
  targetCount,
  targets,
  isAdmin,
  branchName,
}: {
  templates: Template[];
  targetCount: number;
  targets: TargetWithStatus[];
  isAdmin: boolean;
  branchName: string;
}) {
  const [activeTab, setActiveTab] = useState<"target" | "template" | "launch">("target");

  return (
    <div className="min-h-[80vh]">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8 md:p-10 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-purple-500/10" />
        <div className="absolute top-4 right-4 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-4 left-4 w-24 h-24 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                自動営業依頼
              </h1>
              <p className="text-zinc-400 text-sm">
                AI が問い合わせフォームに自動送信します
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">登録済み営業先</p>
                <p className="text-lg font-bold text-white">{targetCount}</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">営業テンプレート</p>
                <p className="text-lg font-bold text-white">{templates.length}</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">拠点</p>
                <p className="text-lg font-bold text-white">{branchName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab("target")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl border-2 transition-all duration-200 ${
            activeTab === "target"
              ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-500/10"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            activeTab === "target"
              ? "bg-blue-500 shadow-md shadow-blue-500/30"
              : "bg-zinc-100"
          }`}>
            <Target className={`w-5 h-5 ${activeTab === "target" ? "text-white" : "text-zinc-400"}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${activeTab === "target" ? "text-blue-700" : "text-zinc-700"}`}>
              営業先を追加
            </p>
            <p className={`text-xs ${activeTab === "target" ? "text-blue-500" : "text-zinc-400"}`}>
              フォームURLと企業情報を登録
            </p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("template")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl border-2 transition-all duration-200 ${
            activeTab === "template"
              ? "border-purple-500 bg-purple-50 shadow-sm shadow-purple-500/10"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            activeTab === "template"
              ? "bg-purple-500 shadow-md shadow-purple-500/30"
              : "bg-zinc-100"
          }`}>
            <FileText className={`w-5 h-5 ${activeTab === "template" ? "text-white" : "text-zinc-400"}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${activeTab === "template" ? "text-purple-700" : "text-zinc-700"}`}>
              営業テンプレート
            </p>
            <p className={`text-xs ${activeTab === "template" ? "text-purple-500" : "text-zinc-400"}`}>
              訴求内容と送信者情報を設定
            </p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("launch")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl border-2 transition-all duration-200 ${
            activeTab === "launch"
              ? "border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-500/10"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            activeTab === "launch"
              ? "bg-emerald-500 shadow-md shadow-emerald-500/30"
              : "bg-zinc-100"
          }`}>
            <Play className={`w-5 h-5 ${activeTab === "launch" ? "text-white" : "text-zinc-400"}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${activeTab === "launch" ? "text-emerald-700" : "text-zinc-700"}`}>
              営業開始
            </p>
            <p className={`text-xs ${activeTab === "launch" ? "text-emerald-500" : "text-zinc-400"}`}>
              テンプレートを選んで送信開始
            </p>
          </div>
        </button>
      </div>

      {/* Content */}
      {activeTab === "target" ? (
        <AddTargetSection onImportComplete={() => setActiveTab("template")} />
      ) : activeTab === "template" ? (
        <TemplateSection templates={templates} isAdmin={isAdmin} />
      ) : (
        <LaunchSection templates={templates} targets={targets} />
      )}
    </div>
  );
}

// ─── CSV パーサー ─────────────────────────────
interface CsvRow {
  companyName: string;
  url: string;
  phone: string;
  industry: string;
  area: string;
}

function parseCsv(text: string): CsvRow[] {
  // Remove BOM
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]);
  const colMap: Record<string, number> = {};
  const mapping: Record<string, string> = {
    "企業名": "companyName",
    "Webサイト": "url",
    "電話番号": "phone",
    "業種": "industry",
    "エリア": "area",
  };

  headers.forEach((h, i) => {
    const key = mapping[h.trim()];
    if (key) colMap[key] = i;
  });

  if (colMap.companyName === undefined) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const companyName = cols[colMap.companyName]?.trim() ?? "";
    const url = cols[colMap.url]?.trim() ?? "";
    if (!companyName) continue;
    rows.push({
      companyName,
      url,
      phone: cols[colMap.phone]?.trim() ?? "",
      industry: cols[colMap.industry]?.trim() ?? "",
      area: cols[colMap.area]?.trim() ?? "",
    });
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── 既存顧客マッチ型 ─────────────────────────
interface CustomerMatch {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  status: string;
  rank: string;
  branchName: string | null;
  matchReasons: string[];
}

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "見込み",
  ACTIVE: "取引中",
  DORMANT: "休眠",
  AVOID: "回避",
};

// ─── 営業先追加セクション ─────────────────────
function AddTargetSection({ onImportComplete }: { onImportComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [checking, setChecking] = useState(false);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CSV import state
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    total: number;
    errors: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 既存顧客の重複チェック（デバウンス付き）
  const checkCustomerDuplicate = useCallback(
    (companyName: string, phone: string, url: string) => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      if (!companyName && !phone && !url) {
        setCustomerMatches([]);
        return;
      }
      checkTimerRef.current = setTimeout(async () => {
        const params = new URLSearchParams();
        if (companyName) params.set("companyName", companyName);
        if (phone) params.set("phone", phone);
        if (url) params.set("url", url);
        setChecking(true);
        try {
          const res = await fetch(`/api/auto-sales/check-customer?${params}`);
          if (res.ok) {
            const data = await res.json();
            setCustomerMatches(data.matches ?? []);
          }
        } catch {
          // silent
        } finally {
          setChecking(false);
        }
      }, 500);
    },
    []
  );

  // フォーム入力変更時に重複チェック発火
  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const form = e.target.form;
      if (!form) return;
      const fd = new FormData(form);
      checkCustomerDuplicate(
        (fd.get("companyName") as string)?.trim() ?? "",
        (fd.get("phone") as string)?.trim() ?? "",
        (fd.get("url") as string)?.trim() ?? ""
      );
    },
    [checkCustomerDuplicate]
  );

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, []);

  const handleCsvFile = useCallback((file: File) => {
    setCsvFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      setCsvData(rows);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
        handleCsvFile(file);
      }
    },
    [handleCsvFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleCsvFile(file);
    },
    [handleCsvFile]
  );

  const clearCsv = useCallback(() => {
    setCsvData([]);
    setCsvFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  async function handleImport() {
    if (csvData.length === 0) return;
    setImporting(true);
    setImportResult(null);

    // Filter rows that have at least companyName and url
    const targets = csvData
      .filter((r) => r.companyName && r.url)
      .map((r) => ({
        companyName: r.companyName,
        url: r.url,
        phone: r.phone || undefined,
        industry: r.industry || undefined,
        area: r.area || undefined,
      }));

    if (targets.length === 0) {
      setImportResult({
        created: 0,
        skipped: csvData.length,
        total: csvData.length,
        errors: ["企業名とWebサイトの両方が必要です"],
      });
      setImporting(false);
      return;
    }

    try {
      const res = await fetch("/api/auto-sales/targets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      if (!res.ok) {
        const body = await res.json();
        setImportResult({
          created: 0,
          skipped: targets.length,
          total: targets.length,
          errors: [body.error ?? "インポートに失敗しました"],
        });
      } else {
        const result = await res.json();
        setImportResult(result);
        if (result.created > 0) {
          setTimeout(() => onImportComplete(), 1500);
        }
      }
    } catch {
      setImportResult({
        created: 0,
        skipped: targets.length,
        total: targets.length,
        errors: ["通信エラーが発生しました"],
      });
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const data = {
      companyName: fd.get("companyName"),
      url: fd.get("url"),
      industry: fd.get("industry"),
      area: fd.get("area"),
      phone: fd.get("phone"),
      note: fd.get("note"),
    };

    try {
      const res = await fetch("/api/auto-sales/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "登録に失敗しました");
        return;
      }
      setSuccess(true);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 mb-2">登録完了</h3>
        <p className="text-sm text-zinc-500 mb-6">営業先が追加されました。テンプレートと紐付けて自動営業を開始できます。</p>
        <button
          onClick={() => setSuccess(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          続けて追加する
        </button>
      </div>
    );
  }

  const validCsvCount = csvData.filter((r) => r.companyName && r.url).length;
  const noUrlCount = csvData.filter((r) => r.companyName && !r.url).length;

  return (
    <div className="space-y-6">
      {/* CSV Import Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" />
            リード管理のCSVをインポート
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            リード獲得AIで取得したCSVファイルをドロップまたは選択
          </p>
        </div>

        <div className="p-6">
          {/* Drop Zone */}
          {!csvFile && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-blue-500 bg-blue-50/50"
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                dragOver ? "bg-blue-100" : "bg-zinc-100"
              }`}>
                <Upload className={`w-6 h-6 ${dragOver ? "text-blue-500" : "text-zinc-400"}`} />
              </div>
              <p className="text-sm font-medium text-zinc-700">
                CSVファイルをドラッグ＆ドロップ
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                またはクリックしてファイルを選択
              </p>
            </div>
          )}

          {/* File loaded - Preview */}
          {csvFile && (
            <div className="space-y-4">
              {/* File info bar */}
              <div className="flex items-center justify-between bg-zinc-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-700">{csvFile.name}</p>
                    <p className="text-xs text-zinc-400">
                      {csvData.length} 件読み込み
                      {noUrlCount > 0 && (
                        <span className="text-amber-500 ml-2">
                          ({noUrlCount} 件はWebサイト未設定)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearCsv}
                  className="w-8 h-8 rounded-lg hover:bg-zinc-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {/* Preview Table */}
              {csvData.length > 0 && (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 whitespace-nowrap">#</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 whitespace-nowrap">企業名</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 whitespace-nowrap">Webサイト</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 whitespace-nowrap">業種</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 whitespace-nowrap">エリア</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 whitespace-nowrap">電話番号</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {csvData.map((row, i) => (
                          <tr
                            key={i}
                            className={`${
                              !row.companyName || !row.url
                                ? "bg-amber-50/50"
                                : "hover:bg-zinc-50"
                            }`}
                          >
                            <td className="px-4 py-2 text-zinc-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-2 text-zinc-700 font-medium whitespace-nowrap max-w-[200px] truncate">
                              {row.companyName || <span className="text-zinc-300">-</span>}
                            </td>
                            <td className="px-4 py-2 text-zinc-500 font-mono text-xs whitespace-nowrap max-w-[200px] truncate">
                              {row.url || <span className="text-amber-400 text-xs font-sans">未設定</span>}
                            </td>
                            <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                              {row.industry || <span className="text-zinc-300">-</span>}
                            </td>
                            <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                              {row.area || <span className="text-zinc-300">-</span>}
                            </td>
                            <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                              {row.phone || <span className="text-zinc-300">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className={`rounded-xl px-4 py-4 border ${
                  importResult.created > 0
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <div className="flex items-start gap-3">
                    {importResult.created > 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-zinc-700">
                        {importResult.created} 件登録 / {importResult.skipped} 件スキップ（全 {importResult.total} 件）
                      </p>
                      {importResult.errors.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {importResult.errors.map((err, i) => (
                            <li key={i} className="text-xs text-zinc-500">
                              {err}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Import Button */}
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={importing || validCsvCount === 0}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {importing ? (
                    "インポート中..."
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      {validCsvCount} 件をインポート
                    </>
                  )}
                </button>
              )}

              {/* After import, allow importing more or clearing */}
              {importResult && (
                <div className="flex gap-3">
                  <button
                    onClick={clearCsv}
                    className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    クリア
                  </button>
                  <button
                    onClick={() => {
                      clearCsv();
                      window.location.reload();
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    完了
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── テンプレートセクション ─────────────────────
function TemplateSection({
  templates,
  isAdmin,
}: {
  templates: Template[];
  isAdmin: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      {/* テンプレート一覧 */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              営業テンプレート
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              送信者情報と訴求内容を設定
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-medium hover:from-purple-700 hover:to-purple-600 transition-all shadow-md shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            新規作成
          </button>
        </div>

        {showCreate && <CreateTemplateForm onClose={() => { setShowCreate(false); window.location.reload(); }} />}

        <div className="p-6">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-zinc-300" />
              </div>
              <p className="text-sm text-zinc-400">
                テンプレートがまだありません
              </p>
              <p className="text-xs text-zinc-300 mt-1">
                「新規作成」から訴求内容を設定してください
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((t, i) => (
                <TemplateCard key={t.id} template={t} index={i} total={templates.length} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── テンプレートカード ─────────────────────────
function TemplateCard({ template: t, index, total }: { template: Template; index: number; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/auto-sales/templates/${t.id}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      }
    } catch {} finally {
      setDeleting(false);
    }
  }

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
      <div className="flex items-center">
        {/* 優先順位バッジ */}
        <div className="pl-4 pr-1 py-4">
          <span className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-xs font-bold text-purple-600">
            {index + 1}
          </span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 p-4 text-left flex items-center gap-4"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            t.isApproved
              ? "bg-emerald-50 border border-emerald-200"
              : "bg-amber-50 border border-amber-200"
          }`}>
            <FileText className={`w-5 h-5 ${t.isApproved ? "text-emerald-600" : "text-amber-600"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm text-zinc-900">{t.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                t.isApproved
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {t.isApproved ? "承認済み" : "承認待ち"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-400">{t.companyName} / {t.senderName}</span>
              <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                {TARGET_TYPE_LABELS[t.targetType] ?? t.targetType}
              </span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-100">
          <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
            {t.serviceTypes?.map((s) => (
              <span key={s} className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-lg border border-purple-100 font-medium">
                {SERVICE_TYPE_OPTIONS.find((o) => o.id === s)?.icon}{" "}
                {SERVICE_TYPE_OPTIONS.find((o) => o.id === s)?.label ?? s}
              </span>
            ))}
          </div>
          <div className="bg-zinc-50 rounded-xl p-4 mb-3">
            <p className="text-xs font-medium text-zinc-500 mb-2">訴求文</p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{t.pitchText}</p>
          </div>

          {/* 削除ボタン */}
          <div className="flex justify-end">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">本当に削除しますか？</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "削除中..." : "削除する"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-zinc-500 px-3 py-1.5 rounded-lg hover:bg-zinc-100"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                削除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── テンプレート作成フォーム ─────────────────────
function CreateTemplateForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTargetType, setSelectedTargetType] = useState<string>("BTOB");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [pitchTextValue, setPitchTextValue] = useState("");
  const [successExamples, setSuccessExamples] = useState<
    { id: string; branchName: string; targetType: string; serviceTypes: string[]; pitchText: string; responseCount: number }[]
  >([]);
  const [showExamples, setShowExamples] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function generatePitch(e: React.MouseEvent) {
    e.preventDefault();
    const form = (e.target as HTMLElement).closest("form");
    if (!form) return;
    const fd = new FormData(form);
    const companyName = (fd.get("companyName") as string)?.trim();
    const senderName = (fd.get("senderName") as string)?.trim();
    if (!companyName || !senderName) {
      setError("AIで生成するには、送信元会社名と送信者名を先に入力してください");
      return;
    }
    if (selectedServices.length === 0) {
      setError("訴求カテゴリを1つ以上選択してください");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/auto-sales/generate-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          senderName,
          targetType: selectedTargetType,
          serviceTypes: selectedServices,
        }),
      });
      if (!res.ok) {
        setError("生成に失敗しました");
        return;
      }
      const data = await res.json();
      setPitchTextValue(data.pitchText);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setGenerating(false);
    }
  }

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function loadSuccessExamples() {
    if (successExamples.length > 0) {
      setShowExamples(!showExamples);
      return;
    }
    try {
      const res = await fetch("/api/auto-sales/success-examples");
      if (res.ok) {
        const data = await res.json();
        setSuccessExamples(data);
      }
    } catch {}
    setShowExamples(true);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (selectedServices.length === 0) {
      setError("訴求カテゴリを1つ以上選択してください");
      setLoading(false);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const startDate = fd.get("scheduledStartDate") as string;
    const data = {
      name: fd.get("name"),
      companyName: fd.get("companyName"),
      senderName: fd.get("senderName"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      targetType: selectedTargetType,
      serviceTypes: selectedServices,
      pitchText: pitchTextValue || fd.get("pitchText"),
      scheduledStartDate: startDate || undefined,
    };

    try {
      const res = await fetch("/api/auto-sales/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "作成に失敗しました");
        return;
      }
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="p-6 border-b border-zinc-100 bg-gradient-to-b from-purple-50/50 to-white space-y-5">
      {/* 設定名 */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          設定名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          placeholder="例: 徳島エリア美容室向け"
          className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
        />
      </div>

      {/* 送信者情報 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Building2 className="w-4 h-4 text-zinc-400" />
            送信元会社名 <span className="text-red-500">*</span>
          </label>
          <input
            name="companyName"
            required
            placeholder="例: ○○ AdArch"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <User className="w-4 h-4 text-zinc-400" />
            送信者名 <span className="text-red-500">*</span>
          </label>
          <input
            name="senderName"
            required
            placeholder="例: アド太郎"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Phone className="w-4 h-4 text-zinc-400" />
            電話番号
          </label>
          <input
            name="phone"
            placeholder="例: 090-XXXX-XXXX"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Mail className="w-4 h-4 text-zinc-400" />
            メールアドレス（固定）
          </label>
          <input
            type="email"
            value="media@adarch.co.jp"
            readOnly
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm bg-zinc-50 text-zinc-500 cursor-not-allowed"
          />
          <p className="text-xs text-zinc-400 mt-1.5">反響データ取得のため、全営業で統一アドレスから送付されます</p>
        </div>
      </div>

      {/* ターゲット種別 */}
      <div>
        <label className="block text-sm font-semibold text-zinc-700 mb-3">
          ターゲット種別 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(["BTOB", "BTOC"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedTargetType(type)}
              className={`py-3.5 rounded-xl text-sm font-bold border-2 transition-all ${
                selectedTargetType === type
                  ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm shadow-purple-500/10"
                  : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
              }`}
            >
              {TARGET_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* 訴求カテゴリ */}
      <div>
        <label className="block text-sm font-semibold text-zinc-700 mb-3">
          訴求カテゴリ（複数選択可） <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {SERVICE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleService(opt.id)}
              className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-sm text-left border-2 transition-all ${
                selectedServices.includes(opt.id)
                  ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm shadow-purple-500/10"
                  : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 訴求文 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            訴求文 <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generatePitch}
              disabled={generating}
              className="inline-flex items-center gap-1 text-xs bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-lg hover:from-purple-700 hover:to-blue-700 font-bold disabled:opacity-50 shadow-sm"
            >
              <Sparkles className="w-3 h-3" />
              {generating ? "生成中..." : "AIで自動生成"}
            </button>
            <button
              type="button"
              onClick={loadSuccessExamples}
              className="text-xs text-purple-600 hover:text-purple-800 font-bold"
            >
              {showExamples ? "閉じる" : "成功実績を参考にする"}
            </button>
          </div>
        </div>

        {showExamples && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 max-h-48 overflow-y-auto">
            {successExamples.length === 0 ? (
              <p className="text-xs text-emerald-600">まだ反響実績がありません。</p>
            ) : (
              successExamples.map((ex) => (
                <div key={ex.id} className="p-3 bg-white rounded-lg border border-emerald-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        反響 {ex.responseCount}件
                      </span>
                      <span className="text-xs text-zinc-400">{ex.branchName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPitchTextValue(ex.pitchText); setShowExamples(false); }}
                      className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 font-medium"
                    >
                      この文を使う
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 whitespace-pre-wrap line-clamp-3 mt-1">{ex.pitchText}</p>
                </div>
              ))
            )}
          </div>
        )}

        <textarea
          name="pitchText"
          required
          rows={8}
          value={pitchTextValue}
          onChange={(e) => setPitchTextValue(e.target.value)}
          className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none placeholder:text-zinc-300"
          placeholder={`突然のご連絡失礼いたします。\n○○エリアで映像制作・広告プロモーションを手がけております○○と申します。\n\n貴社の○○に大変興味を持ち、ご連絡させていただきました。`}
        />
        <p className="text-xs text-zinc-400 mt-1.5">
          {"{industry}"} と書くと営業先の業種名に自動置換されます
        </p>
      </div>

      {/* 開始日 */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          営業開始日
        </label>
        <input
          name="scheduledStartDate"
          type="date"
          className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
        />
        <p className="text-xs text-zinc-400 mt-1.5">未指定の場合、承認後すぐに営業を開始します</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl text-sm font-bold hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2"
      >
        {loading ? (
          "作成中..."
        ) : (
          <>
            テンプレートを登録
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

// ─── 営業開始セクション ─────────────────────────
function LaunchSection({
  templates,
  targets,
}: {
  templates: Template[];
  targets: TargetWithStatus[];
}) {
  const approvedTemplates = templates.filter((t) => t.isApproved);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    approvedTemplates[0]?.id ?? ""
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  // A target is "already sent" if it has an active job (COMPLETED, QUEUED, PROCESSING)
  function isSent(t: TargetWithStatus) {
    if (t.jobs.length === 0) return false;
    const latest = t.jobs[0].status;
    return ["COMPLETED", "QUEUED", "PROCESSING"].includes(latest);
  }

  const eligibleTargets = targets.filter((t) => !isSent(t));
  const allEligibleSelected =
    eligibleTargets.length > 0 &&
    eligibleTargets.every((t) => selectedIds.has(t.id));

  function toggleSelectAll() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleTargets.map((t) => t.id)));
    }
  }

  function toggleTarget(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleLaunch() {
    if (selectedIds.size === 0 || !selectedTemplateId) return;
    setLaunching(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/auto-sales/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetIds: Array.from(selectedIds),
          templateId: selectedTemplateId,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "送信に失敗しました");
        return;
      }
      const data = await res.json();
      setResult(data);
      setSelectedIds(new Set());
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLaunching(false);
    }
  }

  const JOB_STATUS_BADGE: Record<string, { label: string; className: string }> = {
    COMPLETED: { label: "送信済み", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    QUEUED: { label: "待機中", className: "bg-zinc-50 text-zinc-500 border-zinc-200" },
    PROCESSING: { label: "実行中", className: "bg-blue-50 text-blue-700 border-blue-200" },
    FAILED: { label: "失敗", className: "bg-red-50 text-red-700 border-red-200" },
  };

  return (
    <div className="space-y-6">
      {/* Template Selector */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-gradient-to-r from-emerald-50/50 to-white">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Play className="w-5 h-5 text-emerald-500" />
            営業テンプレートを選択
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            承認済みテンプレートを選んで営業先に一斉送信
          </p>
        </div>

        <div className="p-6">
          {approvedTemplates.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-7 h-7 text-amber-400" />
              </div>
              <p className="text-sm font-medium text-zinc-700">
                承認済みテンプレートがありません
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                テンプレートを作成し、本部承認を受けてください。
              </p>
            </div>
          ) : (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-white"
            >
              {approvedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.companyName} / {t.senderName})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Target List */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-gradient-to-r from-emerald-50/50 to-white">
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" />
            営業先を選択
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            送信する営業先にチェックを入れてください
          </p>
        </div>

        {targets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-zinc-300" />
            </div>
            <p className="text-sm font-medium text-zinc-700">
              営業先がまだ登録されていません。
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              「営業先を追加」タブから追加してください。
            </p>
          </div>
        ) : (
          <div>
            {/* Select All */}
            <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
              <input
                type="checkbox"
                checked={allEligibleSelected}
                onChange={toggleSelectAll}
                disabled={eligibleTargets.length === 0}
                className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-zinc-600">
                すべて選択
                <span className="text-xs text-zinc-400 ml-2">
                  ({eligibleTargets.length} 件送信可能 / 全 {targets.length} 件)
                </span>
              </span>
            </div>

            {/* Target Rows */}
            <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
              {targets.map((t) => {
                const sent = isSent(t);
                const latestStatus = t.jobs[0]?.status;
                const badge = latestStatus ? JOB_STATUS_BADGE[latestStatus] : null;

                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${
                      sent
                        ? "bg-zinc-50/50 cursor-not-allowed"
                        : selectedIds.has(t.id)
                        ? "bg-emerald-50/30"
                        : "hover:bg-zinc-50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleTarget(t.id)}
                      disabled={sent}
                      className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-zinc-900 truncate">
                          {t.companyName}
                        </span>
                        {t.industry && (
                          <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-medium">
                            {t.industry}
                          </span>
                        )}
                        {t.area && (
                          <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">
                            {t.area}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate mt-0.5 font-mono max-w-[300px]">
                        {t.url}
                      </p>
                    </div>
                    {badge && (
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium border shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Result Message */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">
                {result.created} 件の営業ジョブを作成しました
              </p>
              {result.skipped > 0 && (
                <p className="text-xs text-emerald-600 mt-0.5">
                  {result.skipped} 件は既にキューに入っていたためスキップ
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          {error}
        </p>
      )}

      {/* Launch Button */}
      {approvedTemplates.length > 0 && targets.length > 0 && (
        <button
          onClick={handleLaunch}
          disabled={launching || selectedIds.size === 0}
          className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl text-sm font-bold hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
        >
          {launching ? (
            "送信処理中..."
          ) : selectedIds.size === 0 ? (
            <>
              <Play className="w-4 h-4" />
              営業先を選択してください
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {selectedIds.size}件の営業先に送信開始
            </>
          )}
        </button>
      )}
    </div>
  );
}
