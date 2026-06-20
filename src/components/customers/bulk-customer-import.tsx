"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, X, Loader2, CheckCircle2, AlertCircle, ClipboardPaste,
  FileSpreadsheet, Globe, Upload, Trash2, Plus, Sparkles,
} from "lucide-react";

// 既存顧客の一括登録モーダル。
// 3つの入力（貼り付け / CSV / URL補完）で行を作り、確認テーブルで整えてから
// まとめて登録する。手打ちを無くすのが目的。

interface Row {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  industry: string;
  prefecture: string;
  address: string;
  notes: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type Mode = "paste" | "csv" | "url";

const EMPTY: Row = {
  name: "", contactName: "", phone: "", email: "",
  website: "", industry: "", prefecture: "", address: "", notes: "",
};

// ヘッダー名 → Rowのキー
const HEADER_MAP: Record<string, keyof Row> = {
  "会社名": "name", "顧客名": "name", "社名": "name", "name": "name",
  "担当者名": "contactName", "担当者": "contactName", "担当": "contactName",
  "電話番号": "phone", "電話": "phone", "tel": "phone", "phone": "phone",
  "メール": "email", "メールアドレス": "email", "email": "email",
  "url": "website", "website": "website", "サイト": "website", "ホームページ": "website",
  "業種": "industry", "industry": "industry",
  "都道府県": "prefecture", "県": "prefecture",
  "住所": "address", "address": "address",
  "メモ": "notes", "備考": "notes", "notes": "notes",
};

// 位置ベースの既定カラム順（ヘッダー無しのとき）
const POSITION_ORDER: (keyof Row)[] = [
  "name", "contactName", "phone", "email", "website", "industry", "prefecture", "address", "notes",
];

function parseTable(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // 区切り判定: タブがあればタブ（スプレッドシート貼り付け）、無ければカンマ
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const split = (l: string) => l.split(delim).map((c) => c.trim());

  // 1行目がヘッダーか判定（会社名/name 等を含むか）
  const firstCells = split(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = firstCells.some((c) => c in HEADER_MAP);

  let colKeys: (keyof Row)[];
  let dataLines: string[];
  if (hasHeader) {
    colKeys = firstCells.map((c) => HEADER_MAP[c] ?? ("" as keyof Row));
    dataLines = lines.slice(1);
  } else {
    colKeys = POSITION_ORDER;
    dataLines = lines;
  }

  return dataLines.map((line) => {
    const cells = split(line);
    const row: Row = { ...EMPTY };
    cells.forEach((val, i) => {
      const key = colKeys[i];
      if (key && key in row) row[key] = val;
    });
    return row;
  }).filter((r) => r.name);
}

export function BulkCustomerImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPasteText(""); setUrlInput(""); setUrlError("");
    setRows([]); setResult(null); setLoading(false);
  }, []);

  const close = useCallback(() => { setOpen(false); reset(); }, [reset]);

  const addParsed = (parsed: Row[]) => {
    if (parsed.length === 0) {
      alert("会社名のある行が見つかりませんでした。1列目が会社名になっているかご確認ください。");
      return;
    }
    setRows((prev) => [...prev, ...parsed]);
    setResult(null);
  };

  const handlePaste = () => { addParsed(parseTable(pasteText)); setPasteText(""); };

  const handleCsv = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => addParsed(parseTable(String(reader.result ?? "")));
    reader.readAsText(f);
  };

  const handleUrl = async () => {
    const u = urlInput.trim();
    if (!u) return;
    setUrlLoading(true); setUrlError("");
    try {
      const res = await fetch("/api/customers/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (!res.ok) { setUrlError(data.error ?? "取得に失敗しました"); return; }
      const c = data.customer;
      setRows((prev) => [...prev, {
        ...EMPTY,
        name: c.name ?? "", contactName: c.contactName ?? "", phone: c.phone ?? "",
        email: c.email ?? "", website: data.website ?? u, industry: c.industry ?? "",
        prefecture: c.prefecture ?? "", address: c.address ?? "", notes: c.notes ?? "",
      }]);
      setUrlInput("");
    } catch {
      setUrlError("通信エラーが発生しました");
    } finally {
      setUrlLoading(false);
    }
  };

  const updateRow = (i: number, key: keyof Row, val: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleRegister = async () => {
    const valid = rows.filter((r) => r.name.trim());
    if (valid.length === 0) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.imported > 0) { setRows([]); router.refresh(); }
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ["通信エラーが発生しました"] });
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Mode; label: string; icon: typeof ClipboardPaste }[] = [
    { key: "paste", label: "貼り付け", icon: ClipboardPaste },
    { key: "csv", label: "CSV", icon: FileSpreadsheet },
    { key: "url", label: "URLから", icon: Globe },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
      >
        <Users className="w-3.5 h-3.5" />
        既存顧客をまとめて登録
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={close} />
          <div className="relative z-50 w-full max-w-3xl bg-white rounded-xl shadow-xl p-6 space-y-4 mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-zinc-900">既存顧客をまとめて登録</h3>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  今のお客様を一度に取り込めます。取り込み後、各顧客の詳細ページから商談の内容を入力して、広告のご提案（商談）に進めます。
                </p>
              </div>
              <button onClick={close} className="p-1 rounded-lg hover:bg-zinc-100">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5 w-fit">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setMode(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === t.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Mode body */}
            {mode === "paste" && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-600">
                  Excel・スプレッドシートから選択してコピーし、そのまま貼り付けてください。
                  列の順番：<span className="text-zinc-400">会社名 / 担当者名 / 電話 / メール / URL / 業種 / 都道府県 / 住所 / メモ</span>
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  placeholder={"株式会社山田工務店\t山田太郎\t03-1234-5678\n有限会社佐藤商店\t佐藤花子\t06-9876-5432"}
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg outline-none focus:border-emerald-400 font-mono"
                />
                <button
                  onClick={handlePaste}
                  disabled={!pasteText.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-800 rounded-lg hover:bg-zinc-900 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  下の一覧に追加
                </button>
              </div>
            )}

            {mode === "csv" && (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-zinc-200 rounded-lg px-6 py-6 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
              >
                <input
                  ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsv(f); if (fileRef.current) fileRef.current.value = ""; }}
                />
                <Upload className="w-7 h-7 text-zinc-300 mx-auto mb-1" />
                <p className="text-sm text-zinc-500">CSVファイルをクリックして選択</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">1行目に「会社名,担当者名,電話…」のヘッダーがあると確実です</p>
              </div>
            )}

            {mode === "url" && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-600">
                  お客様のホームページURLを入れると、会社情報をAIが読み取って自動で入力します。
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleUrl(); }}
                    placeholder="https://example.co.jp"
                    className="flex-1 px-3 py-2 text-xs border border-zinc-200 rounded-lg outline-none focus:border-emerald-400"
                  />
                  <button
                    onClick={handleUrl}
                    disabled={urlLoading || !urlInput.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 whitespace-nowrap"
                  >
                    {urlLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    AIで読み取る
                  </button>
                </div>
                {urlError && (
                  <p className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" /> {urlError}
                  </p>
                )}
              </div>
            )}

            {/* Confirm table */}
            {rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-700">登録する顧客（{rows.length}件）</p>
                  <button onClick={() => setRows([])} className="text-[11px] text-zinc-400 hover:text-red-500">すべてクリア</button>
                </div>
                <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-50 sticky top-0">
                      <tr className="text-left text-zinc-500">
                        <th className="px-2 py-1.5 font-medium">会社名 *</th>
                        <th className="px-2 py-1.5 font-medium">担当者</th>
                        <th className="px-2 py-1.5 font-medium">電話</th>
                        <th className="px-2 py-1.5 font-medium">業種</th>
                        <th className="px-2 py-1.5 font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {rows.map((r, i) => (
                        <tr key={i} className={r.name.trim() ? "" : "bg-red-50/50"}>
                          <td className="px-1 py-1"><input value={r.name} onChange={(e) => updateRow(i, "name", e.target.value)} className="w-full px-1.5 py-1 border border-transparent hover:border-zinc-200 focus:border-emerald-400 rounded outline-none" /></td>
                          <td className="px-1 py-1"><input value={r.contactName} onChange={(e) => updateRow(i, "contactName", e.target.value)} className="w-full px-1.5 py-1 border border-transparent hover:border-zinc-200 focus:border-emerald-400 rounded outline-none" /></td>
                          <td className="px-1 py-1"><input value={r.phone} onChange={(e) => updateRow(i, "phone", e.target.value)} className="w-full px-1.5 py-1 border border-transparent hover:border-zinc-200 focus:border-emerald-400 rounded outline-none" /></td>
                          <td className="px-1 py-1"><input value={r.industry} onChange={(e) => updateRow(i, "industry", e.target.value)} className="w-full px-1.5 py-1 border border-transparent hover:border-zinc-200 focus:border-emerald-400 rounded outline-none" /></td>
                          <td className="px-1 py-1 text-center">
                            <button onClick={() => removeRow(i)} className="p-1 rounded hover:bg-red-50 text-zinc-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  {result.imported > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" /> {result.imported}件を登録しました
                    </span>
                  )}
                  {result.skipped > 0 && <span className="text-zinc-500">{result.skipped}件スキップ（重複）</span>}
                </div>
                {result.errors.length > 0 && (
                  <div className="bg-red-50 rounded-lg px-3 py-2 max-h-28 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 py-0.5">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1 border-t border-zinc-100">
              <button onClick={close} className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 mt-3">閉じる</button>
              <button
                onClick={handleRegister}
                disabled={rows.filter((r) => r.name.trim()).length === 0 || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 mt-3"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> 登録中...</> : <><Users className="w-4 h-4" /> {rows.filter((r) => r.name.trim()).length}件を登録</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
