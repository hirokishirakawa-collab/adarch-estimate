"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, Save, FolderKanban, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createProject } from "@/lib/actions/project";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";

type Customer = { id: string; name: string };

interface Props {
  staffName: string;
  customers: Customer[];
  // 顧客詳細ページから遷移した場合に設定される
  prefillCustomer?: Customer | null;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="ml-1 text-red-500 text-[10px]">必須</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-zinc-400">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "placeholder:text-zinc-400 transition-colors";

const selectClass =
  "w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "transition-colors appearance-none";

export function NewProjectForm({ staffName, customers, prefillCustomer }: Props) {
  const [state, formAction, isPending] = useActionState(createProject, null);

  // ── 顧客選択（検索付きコンボボックス）
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    prefillCustomer?.id ?? ""
  );
  const [customerQuery, setCustomerQuery] = useState(prefillCustomer?.name ?? "");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        // 未選択のまま閉じたら入力をリセット
        if (!selectedCustomerId) setCustomerQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedCustomerId]);

  const filteredCustomers = customerQuery
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerQuery.toLowerCase())
      )
    : customers;

  function handleSelectCustomer(c: Customer) {
    setSelectedCustomerId(c.id);
    setCustomerQuery(c.name);
    setIsDropdownOpen(false);
  }

  function handleClearCustomer() {
    setSelectedCustomerId("");
    setCustomerQuery("");
    setIsDropdownOpen(false);
  }

  // ── プロジェクト名（自動提案のために controlled に）
  const [title, setTitle] = useState("");
  // 自動提案で設定したタイトルを記憶（手動編集との区別用）
  const autoSuggestedRef = useRef<string>("");

  // 顧客選択時にプロジェクト名を自動提案
  useEffect(() => {
    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) {
      // 顧客選択解除時: 自動提案分なら空に戻す
      if (title === autoSuggestedRef.current) {
        setTitle("");
        autoSuggestedRef.current = "";
      }
      return;
    }
    const suggestion = `${cust.name} _ `;
    // タイトルが空 or 前回の自動提案のままなら上書きする
    if (!title || title === autoSuggestedRef.current) {
      setTitle(suggestion);
      autoSuggestedRef.current = suggestion;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, customers]);

  // prefillCustomer がある場合は初期提案もセット
  useEffect(() => {
    if (prefillCustomer && !title) {
      const suggestion = `${prefillCustomer.name} _ `;
      setTitle(suggestion);
      autoSuggestedRef.current = suggestion;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form action={formAction} className="space-y-6">
      {/* hidden: customerId */}
      <input type="hidden" name="customerId" value={selectedCustomerId} />

      {/* 顧客連携バナー（プリフィル時） */}
      {prefillCustomer && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
          <FolderKanban className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            顧客{" "}
            <span className="font-semibold">「{prefillCustomer.name}」</span>{" "}
            に紐づくプロジェクトとして作成されます
          </p>
        </div>
      )}

      {/* プロジェクト名 */}
      <Field
        label="プロジェクト名"
        required
        hint="顧客を選択すると「顧客名 _ 」が自動入力されます"
      >
        <input
          name="title"
          type="text"
          maxLength={100}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 〇〇様 Webサイトリニューアル"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 顧客（会社名）*/}
        <Field label="顧客（会社名）" hint="会社名で検索して選択">
          <div className="relative" ref={comboboxRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setSelectedCustomerId("");
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="会社名で検索..."
              className={cn(inputClass, "pl-8 pr-8")}
            />
            {customerQuery && (
              <button
                type="button"
                onClick={handleClearCustomer}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {isDropdownOpen && (
              <ul className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                <li>
                  <button
                    type="button"
                    onClick={handleClearCustomer}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-50"
                  >
                    — 選択しない（任意）—
                  </button>
                </li>
                {filteredCustomers.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-zinc-400">該当なし</li>
                ) : (
                  filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors",
                          c.id === selectedCustomerId && "bg-blue-50 text-blue-700 font-medium"
                        )}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </Field>

        {/* ステータス */}
        <Field label="ステータス">
          <div className="relative">
            <select name="status" defaultValue="IN_PROGRESS" className={selectClass}>
              {PROJECT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              ▾
            </span>
          </div>
        </Field>

        {/* 納期 */}
        <Field label="納期">
          <input
            name="deadline"
            type="date"
            className={inputClass}
          />
        </Field>

        {/* 担当者（表示のみ） */}
        <Field label="担当者" hint="ログインアカウントから自動取得">
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600">
              {staffName.charAt(0)}
            </div>
            <span className="text-sm text-zinc-700">{staffName}</span>
          </div>
        </Field>
      </div>

      {/* 概要 */}
      <Field label="概要・説明" hint="最大1000文字">
        <textarea
          name="description"
          rows={4}
          maxLength={1000}
          placeholder="プロジェクトの目的・スコープ・特記事項など"
          className={cn(inputClass, "resize-none leading-relaxed")}
        />
      </Field>

      {/* エラー */}
      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">{state.error}</p>
        </div>
      )}

      {/* ボタン */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/dashboard/projects"
          className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          キャンセル
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              プロジェクトを作成
            </>
          )}
        </button>
      </div>
    </form>
  );
}
