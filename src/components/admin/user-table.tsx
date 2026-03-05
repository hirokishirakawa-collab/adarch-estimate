"use client";

import { useActionState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { updateUserRole, updateUserInfo, deleteUser } from "@/lib/actions/admin";
import { BRANCH_MAP } from "@/lib/data/customers";

// ---------------------------------------------------------------
// 型
// ---------------------------------------------------------------
type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  branchId:  string | null;
  branchId2: string | null;
  groupCompanyId: string | null;
  createdAt: Date;
  branch:  { name: string } | null;
  branch2: { name: string } | null;
  groupCompany: { id: string; name: string } | null;
};

type GroupCompanyOption = {
  id: string;
  name: string;
  ownerName: string;
};

interface Props {
  users: UserRow[];
  callerEmail: string;
  groupCompanies: GroupCompanyOption[];
}

// ---------------------------------------------------------------
// 定数
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

// 既存14拠点グループ + 47都道府県グループ
const LEGACY_IDS = new Set([
  "branch_hq","branch_isk","branch_kgo","branch_kyt","branch_tky",
  "branch_ymc","branch_hkd","branch_tk2","branch_kns","branch_okn",
  "branch_tks","branch_ibk","branch_fku","branch_knw",
]);

const LEGACY_OPTIONS = Object.values(BRANCH_MAP)
  .filter((b) => LEGACY_IDS.has(b.id))
  .map((b) => ({ value: b.id, label: b.name }));

const PREF_OPTIONS = Object.values(BRANCH_MAP)
  .filter((b) => !LEGACY_IDS.has(b.id))
  .map((b) => ({ value: b.id, label: b.name }));

const inputCls =
  "px-2 py-1 text-xs border border-zinc-200 rounded-md " +
  "focus:outline-none focus:ring-2 focus:ring-zinc-300 " +
  "bg-white text-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed";

const submitCls =
  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium " +
  "bg-zinc-800 text-white rounded-md hover:bg-zinc-700 " +
  "disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

// ---------------------------------------------------------------
// 拠点 select（グループ分け）
// ---------------------------------------------------------------
function BranchSelect({
  name,
  defaultValue,
  disabled,
}: {
  name: string;
  defaultValue: string | null;
  disabled: boolean;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} disabled={disabled} className={`${inputCls} max-w-[160px]`}>
      <option value="">— 未割当 —</option>
      <optgroup label="【既存拠点】">
        {LEGACY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </optgroup>
      <optgroup label="【都道府県】">
        {PREF_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </optgroup>
    </select>
  );
}

// ---------------------------------------------------------------
// ロール変更フォーム
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

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="role"
        defaultValue={currentRole}
        disabled={disabled || isPending}
        className={inputCls}
      >
        {ROLE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button type="submit" disabled={disabled || isPending} className={submitCls}>
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        変更
      </button>
      {state?.success && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
      {state?.error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{state.error}
        </span>
      )}
    </form>
  );
}

// ---------------------------------------------------------------
// 名前・拠点変更フォーム（拠点2つ）
// ---------------------------------------------------------------
function GroupCompanySelect({
  name,
  defaultValue,
  disabled,
  options,
}: {
  name: string;
  defaultValue: string | null;
  disabled: boolean;
  options: GroupCompanyOption[];
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} disabled={disabled} className={`${inputCls} max-w-[160px]`}>
      <option value="">— 未紐付 —</option>
      {options.map((gc) => (
        <option key={gc.id} value={gc.id}>{gc.name}（{gc.ownerName}）</option>
      ))}
    </select>
  );
}

function InfoForm({
  userId,
  currentName,
  currentBranchId,
  currentBranchId2,
  currentGroupCompanyId,
  disabled,
  groupCompanies,
}: {
  userId: string;
  currentName: string | null;
  currentBranchId: string | null;
  currentBranchId2: string | null;
  currentGroupCompanyId: string | null;
  disabled: boolean;
  groupCompanies: GroupCompanyOption[];
}) {
  const boundAction = updateUserInfo.bind(null, userId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        type="text"
        defaultValue={currentName ?? ""}
        placeholder="表示名"
        disabled={disabled || isPending}
        className={`${inputCls} w-24`}
      />
      <BranchSelect name="branchId"  defaultValue={currentBranchId}  disabled={disabled || isPending} />
      <BranchSelect name="branchId2" defaultValue={currentBranchId2} disabled={disabled || isPending} />
      <GroupCompanySelect name="groupCompanyId" defaultValue={currentGroupCompanyId} disabled={disabled || isPending} options={groupCompanies} />
      <button type="submit" disabled={disabled || isPending} className={submitCls}>
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        保存
      </button>
      {state?.success && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
      {state?.error && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{state.error}
        </span>
      )}
    </form>
  );
}

// ---------------------------------------------------------------
// 削除フォーム
// ---------------------------------------------------------------
function DeleteForm({ userId, disabled }: { userId: string; disabled: boolean }) {
  const boundAction = deleteUser.bind(null, userId);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("このユーザーを削除しますか？")) e.preventDefault();
      }}
    >
      <button type="submit" disabled={disabled || isPending} className={`${submitCls} bg-red-600 hover:bg-red-500`}>
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        削除
      </button>
      {state?.error && (
        <span className="ml-2 text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}

// ---------------------------------------------------------------
// テーブル本体
// ---------------------------------------------------------------
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "short", day: "numeric",
  }).format(new Date(d));
}

function branchLabel(branch: { name: string } | null, role: string, isSecond = false): string {
  if (isSecond) return branch?.name ?? "—";
  return branch?.name ?? (role === "ADMIN" ? "本部" : "未割当");
}

export function UserTable({ users, callerEmail, groupCompanies }: Props) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-100">
              {[
                ["メールアドレス", "text-left"],
                ["名前・拠点（編集可）", "text-left"],
                ["現在のロール",  "text-left"],
                ["ロール変更",    "text-left"],
                ["登録日",        "text-left"],
                ["",              "text-left"],
              ].map(([label, cls], i) => (
                <th key={i} className={`px-4 py-2.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap ${cls}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {users.map((user) => {
              const isSelf   = user.email === callerEmail;
              const badgeCls = ROLE_BADGE[user.role] ?? ROLE_BADGE.USER;

              return (
                <tr key={user.id} className={`hover:bg-zinc-50/50 transition-colors ${isSelf ? "bg-blue-50/30" : ""}`}>
                  {/* メール */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-zinc-600">{user.email}</span>
                    {isSelf && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">自分</span>
                    )}
                  </td>

                  {/* 名前・拠点（インライン編集） */}
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <div className="text-xs text-zinc-500 space-y-0.5">
                        <div>{user.name ?? "—"}</div>
                        <div className="text-zinc-400">
                          {branchLabel(user.branch, user.role)}
                          {user.branchId2 && ` / ${branchLabel(user.branch2, user.role, true)}`}
                        </div>
                      </div>
                    ) : (
                      <InfoForm
                        key={`${user.id}-${user.name}-${user.branchId}-${user.branchId2}-${user.groupCompanyId}`}
                        userId={user.id}
                        currentName={user.name}
                        currentBranchId={user.branchId}
                        currentBranchId2={user.branchId2}
                        currentGroupCompanyId={user.groupCompanyId}
                        disabled={false}
                        groupCompanies={groupCompanies}
                      />
                    )}
                  </td>

                  {/* 現在のロール */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badgeCls}`}>
                      {user.role}
                    </span>
                  </td>

                  {/* ロール変更 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isSelf ? (
                      <span className="text-xs text-zinc-400">変更不可（自分）</span>
                    ) : (
                      <RoleForm key={`${user.id}-${user.role}`} userId={user.id} currentRole={user.role} disabled={false} />
                    )}
                  </td>

                  {/* 登録日 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-zinc-500">{fmtDate(user.createdAt)}</span>
                  </td>

                  {/* 削除 */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isSelf ? (
                      <span className="text-xs text-zinc-300">—</span>
                    ) : (
                      <DeleteForm userId={user.id} disabled={false} />
                    )}
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
