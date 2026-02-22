"use client";

import { useActionState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { updateUserRole } from "@/lib/actions/admin";

// ---------------------------------------------------------------
// 型
// ---------------------------------------------------------------
type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
  branch: { name: string } | null;
};

interface Props {
  users: UserRow[];
  callerEmail: string; // 自分自身の行を識別するため
}

// ---------------------------------------------------------------
// ロール選択肢
// ---------------------------------------------------------------
const ROLE_OPTIONS = [
  { value: "ADMIN",   label: "ADMIN（本部）" },
  { value: "MANAGER", label: "MANAGER（代表）" },
  { value: "USER",    label: "USER（一般）" },
] as const;

const ROLE_BADGE: Record<string, string> = {
  ADMIN:   "bg-amber-50 text-amber-700 border-amber-200",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200",
  USER:    "bg-zinc-100 text-zinc-600 border-zinc-200",
};

// ---------------------------------------------------------------
// 1行分のロール変更フォーム
// ---------------------------------------------------------------
function RoleForm({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: string;
  disabled: boolean;
}) {
  const boundAction = updateUserRole.bind(null, userId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  const selectCls =
    "px-2 py-1 text-xs border border-zinc-200 rounded-md " +
    "focus:outline-none focus:ring-2 focus:ring-zinc-300 " +
    "bg-white text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="role"
        defaultValue={currentRole}
        disabled={disabled || isPending}
        className={selectCls}
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={disabled || isPending}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium
                   bg-zinc-800 text-white rounded-md hover:bg-zinc-700
                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        変更
      </button>

      {state?.success && (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      )}
      {state?.error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {state.error}
        </span>
      )}
    </form>
  );
}

// ---------------------------------------------------------------
// ユーザーテーブル本体
// ---------------------------------------------------------------
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(d));
}

export function UserTable({ users, callerEmail }: Props) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {[
                ["名前",         "text-left"],
                ["メールアドレス", "text-left"],
                ["拠点",         "text-left"],
                ["現在のロール",  "text-left"],
                ["ロール変更",    "text-left"],
                ["登録日",        "text-left"],
              ].map(([label, cls], i) => (
                <th
                  key={i}
                  className={`px-4 py-2.5 text-[11px] font-semibold text-zinc-500
                              uppercase tracking-wider whitespace-nowrap ${cls}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {users.map((user) => {
              const isSelf = user.email === callerEmail;
              const badgeCls = ROLE_BADGE[user.role] ?? ROLE_BADGE.USER;

              return (
                <tr
                  key={user.id}
                  className={`hover:bg-zinc-50/50 transition-colors ${
                    isSelf ? "bg-blue-50/30" : ""
                  }`}
                >
                  {/* 名前 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-semibold text-zinc-800">
                      {user.name ?? "—"}
                    </span>
                    {isSelf && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded
                                       bg-blue-100 text-blue-700 font-semibold">
                        自分
                      </span>
                    )}
                  </td>

                  {/* メール */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-500">{user.email}</span>
                  </td>

                  {/* 拠点 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-zinc-500">
                      {user.branch?.name ?? (user.role === "ADMIN" ? "本部" : "—")}
                    </span>
                  </td>

                  {/* 現在のロール */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px]
                                  font-semibold rounded-full border ${badgeCls}`}
                    >
                      {user.role}
                    </span>
                  </td>

                  {/* ロール変更フォーム */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isSelf ? (
                      <span className="text-xs text-zinc-400">変更不可（自分）</span>
                    ) : (
                      <RoleForm
                        userId={user.id}
                        currentRole={user.role}
                        disabled={false}
                      />
                    )}
                  </td>

                  {/* 登録日 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-zinc-500">{fmtDate(user.createdAt)}</span>
                  </td>
                </tr>
              );
            })}

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-zinc-400">
                  登録済みのユーザーがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
