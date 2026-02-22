"use client";

import { useActionState, useState } from "react";
import { Loader2, Save, Building2, Phone, Mail, Globe, MapPin, FileText, User, Tag, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { createCustomer } from "@/lib/actions/customer";
import {
  CUSTOMER_RANK_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  INDUSTRY_OPTIONS,
  SOURCE_OPTIONS,
  PREFECTURES,
} from "@/lib/constants/crm";

interface Props {
  userName: string;
  userEmail: string;
}

// ---------------------------------------------------------------
// セクションラベル
// ---------------------------------------------------------------
function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
      <span className="text-zinc-400">{icon}</span>
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  );
}

// ---------------------------------------------------------------
// フィールドラッパー
// ---------------------------------------------------------------
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
        {required && (
          <span className="ml-1 text-red-500 text-[10px]">必須</span>
        )}
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

// ---------------------------------------------------------------
// メインフォーム
// ---------------------------------------------------------------
export function NewCustomerForm({ userName, userEmail }: Props) {
  const [state, formAction, isPending] = useActionState(createCustomer, null);
  const [rank, setRank] = useState<string>("B");

  return (
    <form action={formAction} className="space-y-8">
      {/* ===== 基本情報 ===== */}
      <div className="space-y-5">
        <SectionHeader
          icon={<Building2 className="w-3.5 h-3.5" />}
          title="基本情報"
        />

        {/* レコード番号（表示のみ） */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-200">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
            レコード番号
          </span>
          <span className="text-xs text-zinc-400 ml-auto">
            保存後に自動採番されます
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="会社名" required>
            <input
              name="name"
              type="text"
              placeholder="株式会社 ○○"
              maxLength={64}
              required
              className={inputClass}
            />
          </Field>

          <Field label="フリガナ" hint="カタカナで入力">
            <input
              name="nameKana"
              type="text"
              placeholder="カブシキガイシャ ○○"
              maxLength={64}
              className={inputClass}
            />
          </Field>

          <Field label="法人番号" hint="13桁の数字">
            <input
              name="corporateNumber"
              type="text"
              placeholder="1234567890123"
              maxLength={13}
              pattern="\d{13}"
              className={inputClass}
            />
          </Field>

          <Field label="業種">
            <div className="relative">
              <select name="industry" className={selectClass}>
                <option value="">選択してください</option>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                ▾
              </span>
            </div>
          </Field>
        </div>
      </div>

      {/* ===== 顧客分類 ===== */}
      <div className="space-y-5">
        <SectionHeader
          icon={<Tag className="w-3.5 h-3.5" />}
          title="顧客分類"
        />

        {/* 隠し input で rank を送信 */}
        <input type="hidden" name="rank" value={rank} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 顧客ランク（ラジオ風ボタン） */}
          <Field label="顧客ランク" required>
            <div className="flex gap-2">
              {CUSTOMER_RANK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRank(opt.value)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border-2 text-xs font-bold transition-all",
                    rank === opt.value
                      ? cn(opt.className, "border-current shadow-sm")
                      : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                  )}
                >
                  <div className="text-base leading-none">{opt.label}</div>
                  <div className="text-[10px] font-normal mt-0.5">
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </Field>

          {/* 取引ステータス */}
          <Field label="取引ステータス">
            <div className="relative">
              <select
                name="status"
                defaultValue="PROSPECT"
                className={selectClass}
              >
                {CUSTOMER_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                ▾
              </span>
            </div>
          </Field>

          {/* 流入経路 */}
          <Field label="流入経路">
            <div className="relative">
              <select name="source" className={selectClass}>
                <option value="">選択してください</option>
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                ▾
              </span>
            </div>
          </Field>
        </div>
      </div>

      {/* ===== 連絡先情報 ===== */}
      <div className="space-y-5">
        <SectionHeader
          icon={<Phone className="w-3.5 h-3.5" />}
          title="連絡先情報"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="担当者名">
            <input
              name="contactName"
              type="text"
              placeholder="山田 太郎"
              maxLength={64}
              className={inputClass}
            />
          </Field>

          <Field label="電話番号">
            <input
              name="phone"
              type="tel"
              placeholder="03-1234-5678"
              maxLength={20}
              className={inputClass}
            />
          </Field>

          <Field label="メールアドレス">
            <input
              name="email"
              type="email"
              placeholder="info@example.co.jp"
              className={inputClass}
            />
          </Field>

          <Field label="Webサイト">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                name="website"
                type="url"
                placeholder="https://example.co.jp"
                className={cn(inputClass, "pl-8")}
              />
            </div>
          </Field>
        </div>
      </div>

      {/* ===== 住所 ===== */}
      <div className="space-y-5">
        <SectionHeader
          icon={<MapPin className="w-3.5 h-3.5" />}
          title="住所"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="郵便番号" hint="ハイフンあり・なし どちらも可">
            <input
              name="postalCode"
              type="text"
              placeholder="100-0001"
              maxLength={8}
              className={inputClass}
            />
          </Field>

          <Field label="都道府県">
            <div className="relative">
              <select name="prefecture" className={selectClass}>
                <option value="">選択してください</option>
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                ▾
              </span>
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field label="住所（番地）" hint="最大256文字">
              <input
                name="address"
                type="text"
                placeholder="千代田区千代田1-1"
                maxLength={256}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="ビル名・部屋番号" hint="最大128文字">
              <input
                name="building"
                type="text"
                placeholder="○○ビル 5F"
                maxLength={128}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ===== 担当・備考 ===== */}
      <div className="space-y-5">
        <SectionHeader
          icon={<User className="w-3.5 h-3.5" />}
          title="担当・備考"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 担当者（ログインユーザー固定・表示のみ） */}
          <Field label="担当者" hint="ログインアカウントから自動設定">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600">
                {userName.charAt(0)}
              </div>
              <span className="text-sm text-zinc-700">{userName}</span>
              <span className="text-[10px] text-zinc-400 ml-auto">
                {userEmail}
              </span>
            </div>
          </Field>
        </div>

        <Field label="備考" hint="最大1000文字">
          <textarea
            name="notes"
            rows={4}
            placeholder="営業経緯・特記事項など"
            maxLength={1000}
            className={cn(inputClass, "resize-none leading-relaxed")}
          />
        </Field>
      </div>

      {/* ===== 初回商談（自動作成案内） ===== */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-100">
        <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          顧客を保存すると、ステータス「見込み」の
          <span className="font-semibold">初回商談</span>
          が自動作成されます。商談の詳細は顧客詳細ページから編集できます。
        </p>
      </div>

      {/* ===== エラー表示 ===== */}
      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">{state.error}</p>
        </div>
      )}

      {/* ===== 送信ボタン ===== */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href="/dashboard/customers"
          className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          キャンセル
        </a>
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
              顧客を登録する
            </>
          )}
        </button>
      </div>
    </form>
  );
}
