"use client";

import { useActionState } from "react";
import { Loader2, CheckCircle2, AlertCircle, UserPlus } from "lucide-react";
import { registerMember } from "@/lib/actions/admin";
import { BRANCH_MAP } from "@/lib/data/customers";

const BRANCH_OPTIONS = [
  { value: "",           label: "— 未割当（ADMINの場合は不要）—" },
  ...Object.values(BRANCH_MAP).map((b) => ({ value: b.id, label: b.name })),
];

const ROLE_OPTIONS = [
  { value: "MANAGER", label: "MANAGER（代表）" },
  { value: "USER",    label: "USER（一般社員）" },
  { value: "ADMIN",   label: "ADMIN（本部）" },
];

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white text-zinc-800 " +
  "disabled:opacity-50";

export function RegisterMemberForm() {
  const [state, formAction, isPending] = useActionState(registerMember, null);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-4 h-4 text-zinc-500" />
        <h3 className="text-sm font-semibold text-zinc-800">メンバーを登録・更新</h3>
        <span className="text-[11px] text-zinc-400">ログイン前に事前登録できます</span>
      </div>

      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* メールアドレス */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="xxx@adarch.co.jp"
            disabled={isPending}
            className={inputCls}
          />
        </div>

        {/* 表示名 */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
            表示名（担当者名）
          </label>
          <input
            name="name"
            type="text"
            placeholder="例：山田 太郎"
            disabled={isPending}
            className={inputCls}
          />
        </div>

        {/* ロール */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
            ロール <span className="text-red-500">*</span>
          </label>
          <select name="role" required disabled={isPending} className={inputCls}>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 拠点 */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
            拠点
          </label>
          <select name="branchId" disabled={isPending} className={inputCls}>
            {BRANCH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 送信 */}
        <div className="sm:col-span-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       bg-zinc-800 text-white rounded-lg hover:bg-zinc-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            登録する
          </button>

          {state?.success && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              登録しました
            </span>
          )}
          {state?.error && (
            <span className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {state.error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
