"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { Loader2, Upload, X, FileText, Search, ChevronDown } from "lucide-react";

type Project  = { id: string; title: string; customerId: string | null };
type Customer = { id: string; name: string; email: string | null; contactName: string | null };

export interface Props {
  action: (prev: { error?: string } | null, formData: FormData) => Promise<{ error?: string }>;
  projects: Project[];
  customers: Customer[];
  defaultValues?: {
    subject?: string;
    customerId?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    billingDate?: string;   // "YYYY-MM-DD"
    dueDate?: string | null;
    details?: string | null;
    amountExclTax?: number;
    inspectionStatus?: string | null;
    fileUrl?: string | null;
    notes?: string | null;
    projectId?: string | null;
  };
  submitLabel?: string;
}

function fmtNum(n: number): string {
  return n.toLocaleString("ja-JP");
}

// ── 顧客検索コンボボックス ──
function CustomerCombobox({
  customers,
  selectedCustomerId,
  onSelect,
  inputCls,
}: {
  customers: Customer[];
  selectedCustomerId: string;
  onSelect: (id: string) => void;
  inputCls: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // 検索フィルタ
  const filtered = query
    ? customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : customers;

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
        請求先会社名
        <span className="text-red-500 ml-0.5">*</span>
      </label>

      {/* 選択済み表示 or 検索入力 */}
      {selectedCustomer && !isOpen ? (
        <button
          type="button"
          onClick={() => { setIsOpen(true); setQuery(""); }}
          className={`${inputCls} text-left flex items-center justify-between`}
        >
          <span>{selectedCustomer.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder="会社名を入力して検索..."
            autoFocus={isOpen}
            className={`${inputCls} pl-9`}
          />
        </div>
      )}

      {/* ドロップダウンリスト */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-zinc-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-zinc-400 text-center">該当する顧客がありません</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  setQuery("");
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors ${
                  c.id === selectedCustomerId ? "bg-violet-50 text-violet-700 font-semibold" : "text-zinc-700"
                }`}
              >
                {c.name}
                {c.email && <span className="ml-2 text-[11px] text-zinc-400">{c.email}</span>}
              </button>
            ))
          )}
        </div>
      )}

      {/* バリデーション用（hidden required） */}
      {!selectedCustomerId && (
        <input
          tabIndex={-1}
          className="opacity-0 absolute h-0 w-0"
          required
          value=""
          onChange={() => {}}
          aria-hidden="true"
        />
      )}

      <p className="mt-1 text-[11px] text-zinc-400">
        会社名の一部を入力して検索できます。
        未登録の場合は先に顧客管理へ追加してください。
      </p>
    </div>
  );
}

export function InvoiceRequestForm({
  action,
  projects,
  customers,
  defaultValues,
  submitLabel = "申請する",
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  // ── プロジェクト選択
  const [selectedProjectId, setSelectedProjectId] = useState(defaultValues?.projectId ?? "");

  // ── 請求先顧客選択（プロジェクト連動）
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultValues?.customerId ?? "");

  // ── 請求先担当者（顧客連動・手動変更も可能）
  const [contactName, setContactName] = useState(defaultValues?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(defaultValues?.contactEmail ?? "");

  // プロジェクトが変わったら対応顧客を自動セット
  useEffect(() => {
    if (!selectedProjectId) return;
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (proj?.customerId) {
      setSelectedCustomerId(proj.customerId);
      const cust = customers.find((c) => c.id === proj.customerId);
      if (cust?.contactName) setContactName(cust.contactName);
      if (cust?.email) setContactEmail(cust.email);
    }
  }, [selectedProjectId, projects, customers]);

  // 顧客が変わったら担当者名・メールを自動補完
  useEffect(() => {
    if (!selectedCustomerId) return;
    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (cust?.contactName) setContactName(cust.contactName);
    if (cust?.email) setContactEmail(cust.email);
  }, [selectedCustomerId, customers]);

  // ── 税計算
  const initAmount = defaultValues?.amountExclTax ?? 0;
  const [amountExclTax, setAmountExclTax] = useState(initAmount);
  const taxAmount     = Math.round(amountExclTax * 0.1);
  const amountInclTax = amountExclTax + taxAmount;

  // ── ファイル選択
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const existingFileUrl = defaultValues?.fileUrl ?? null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
  }
  function clearFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const inputCls =
    "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
    "focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 " +
    "bg-white text-zinc-900";

  return (
    <form action={formAction} className="space-y-5 max-w-xl" encType="multipart/form-data">
      {state?.error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── 件名 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          件名<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="text" name="subject"
          defaultValue={defaultValues?.subject ?? ""}
          placeholder="例: ○○ビル 外壁改修工事 請求"
          required maxLength={200}
          className={inputCls}
        />
      </div>

      {/* ── プロジェクト選択（先に選ぶと顧客・メールが自動補完） ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          関連プロジェクト
          <span className="ml-1.5 text-zinc-400 font-normal text-[11px]">
            ※ 選択すると請求先と担当者メールが自動補完されます
          </span>
        </label>
        <select
          name="projectId"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className={inputCls}
        >
          <option value="">— 選択してください（任意）—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* ── 請求先会社名（顧客管理から検索・選択） ── */}
      <CustomerCombobox
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onSelect={(id) => setSelectedCustomerId(id)}
        inputCls={inputCls}
      />
      <input type="hidden" name="customerId" value={selectedCustomerId} />

      {/* ── 請求先担当者名 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          請求先担当者名
        </label>
        <input
          type="text" name="contactName"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="例: 田中 太郎"
          maxLength={100}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-zinc-400">
          顧客選択時に自動入力されますが、変更・削除できます。
        </p>
      </div>

      {/* ── 請求先担当者メールアドレス（必須・顧客連動） ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          請求先担当者メールアドレス<span className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          type="email" name="contactEmail"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="例: tanaka@example.com"
          required maxLength={200}
          className={inputCls}
        />
        <p className="mt-1 text-[11px] text-zinc-400">
          顧客管理にメールアドレスが登録されていれば自動入力されます。
        </p>
      </div>

      {/* ── 日付 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            請求日<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="date" name="billingDate"
            defaultValue={defaultValues?.billingDate ?? new Date().toISOString().slice(0, 10)}
            required
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">支払期限</label>
          <input
            type="date" name="dueDate"
            defaultValue={defaultValues?.dueDate ?? ""}
            className={inputCls}
          />
        </div>
      </div>

      {/* ── 金額（自動計算） ── */}
      <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50">
        <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">金額</p>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            税抜金額<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">¥</span>
            <input
              type="number" name="amountExclTax"
              min={0} step={1}
              value={amountExclTax === 0 ? "" : amountExclTax}
              onChange={(e) => setAmountExclTax(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              required
              className={`${inputCls} pl-7`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <p className="text-[11px] text-zinc-500 mb-1">消費税（10%）</p>
            <p className="text-base font-bold text-zinc-700">¥{fmtNum(taxAmount)}</p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 mb-1">税込合計</p>
            <p className="text-base font-bold text-violet-700">¥{fmtNum(amountInclTax)}</p>
          </div>
        </div>
        <input type="hidden" name="taxAmount"     value={taxAmount} />
        <input type="hidden" name="amountInclTax" value={amountInclTax} />
      </div>

      {/* ── 内訳 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">内訳</label>
        <textarea
          name="details" rows={4}
          defaultValue={defaultValues?.details ?? ""}
          placeholder={"例:\n施工費 ¥800,000\n材料費 ¥150,000"}
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* ── 検収状況 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">検収状況</label>
        <select name="inspectionStatus" defaultValue={defaultValues?.inspectionStatus ?? ""} className={inputCls}>
          <option value="">— 未設定 —</option>
          <option value="未検収">未検収</option>
          <option value="検収待ち">検収待ち</option>
          <option value="検収済み">検収済み</option>
        </select>
      </div>

      {/* ── 見積書 PDF ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">見積書PDF</label>

        {existingFileUrl && !selectedFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-violet-50 border border-violet-100
                          rounded-lg text-xs text-violet-700">
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <a href={existingFileUrl} target="_blank" rel="noopener noreferrer"
               className="truncate hover:underline flex-1">現在のファイルを開く</a>
          </div>
        )}

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
                            border-zinc-200 rounded-lg cursor-pointer hover:border-violet-300
                            hover:bg-violet-50 transition-colors text-xs text-zinc-400">
            <Upload className="w-4 h-4" />
            <span>PDFファイルを選択</span>
            <input ref={fileInputRef} type="file" name="file" accept=".pdf,application/pdf"
                   className="hidden" onChange={handleFileChange} />
          </label>
        )}

        <div className="mt-2">
          <label className="block text-[11px] text-zinc-400 mb-1">
            または、PDFのURL（Google Drive 等）を直接入力
          </label>
          <input type="url" name="fileUrl"
                 defaultValue={existingFileUrl ?? ""}
                 placeholder="https://drive.google.com/..."
                 className={`${inputCls} text-xs`} />
        </div>
      </div>

      {/* ── 備考 ── */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">備考</label>
        <textarea name="notes" rows={3}
                  defaultValue={defaultValues?.notes ?? ""}
                  placeholder="特記事項など"
                  className={`${inputCls} resize-y`} />
      </div>

      {/* ── 送信ボタン ── */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-violet-600 text-white
                           text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60
                           transition-colors">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitLabel}
        </button>
        <a href="/dashboard/billing"
           className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
          キャンセル
        </a>
      </div>
    </form>
  );
}
