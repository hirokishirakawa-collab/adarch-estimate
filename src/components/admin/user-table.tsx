"use client";

import { useActionState, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { updateUserRole, updateUserInfo, deleteUser, toggleFeature, toggleUserActive, toggleLearningExempt } from "@/lib/actions/admin";
import { BRANCH_MAP } from "@/lib/data/customers";

// ---------------------------------------------------------------
// 型
// ---------------------------------------------------------------
type SuspendReasonValue = "MONTHLY_REPORT" | "ROYALTY_UNPAID" | "OTHER" | null;

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  suspendCount: number;
  suspendReason: SuspendReasonValue;
  branchId:  string | null;
  branchId2: string | null;
  groupCompanyId: string | null;
  enabledFeatures: string[];
  learningExempt: boolean;
  createdAt: Date;
  branch:  { name: string } | null;
  branch2: { name: string } | null;
  groupCompany: { id: string; name: string } | null;
};

const SUSPEND_REASON_LABEL: Record<Exclude<SuspendReasonValue, null>, string> = {
  MONTHLY_REPORT: "月次報告未提出",
  ROYALTY_UNPAID: "ロイヤリティ未払い",
  OTHER: "その他",
};

const SUSPEND_REASON_COLOR: Record<Exclude<SuspendReasonValue, null>, string> = {
  MONTHLY_REPORT: "bg-amber-50 text-amber-700 border-amber-200",
  ROYALTY_UNPAID: "bg-red-50 text-red-700 border-red-200",
  OTHER: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

const OPTIONAL_FEATURES = [
  { id: "cutsheet", label: "カット表AI" },
  { id: "auto-sales", label: "自動営業" },
] as const;

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
// 機能トグル
// ---------------------------------------------------------------
function FeatureToggle({
  userId,
  featureId,
  label,
  enabled,
}: {
  userId: string;
  featureId: string;
  label: string;
  enabled: boolean;
}) {
  const [isPending, setIsPending] = useState(false);
  const [isOn, setIsOn] = useState(enabled);

  const handleToggle = async () => {
    setIsPending(true);
    const result = await toggleFeature(userId, featureId);
    if (result.success) setIsOn(!isOn);
    setIsPending(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
        isOn
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100"
      } ${isPending ? "opacity-50" : ""}`}
      title={`${label}: ${isOn ? "ON" : "OFF"}`}
    >
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isOn ? "✓" : "−"}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------
// ラーニング資格免除トグル
// ---------------------------------------------------------------
function LearningExemptToggle({ userId, enabled }: { userId: string; enabled: boolean }) {
  const [isPending, setIsPending] = useState(false);
  const [isOn, setIsOn] = useState(enabled);

  const handleToggle = async () => {
    setIsPending(true);
    const result = await toggleLearningExempt(userId);
    if (result.success) setIsOn(!isOn);
    setIsPending(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
        isOn
          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          : "bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100"
      } ${isPending ? "opacity-50" : ""}`}
      title={`資格免除: ${isOn ? "ON（既存加盟者）" : "OFF（テスト合格必須）"}`}
    >
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : isOn ? "✓" : "−"}
      資格免除
    </button>
  );
}

// ---------------------------------------------------------------
// アカウント停止/復活トグル（停止時は理由選択モーダル表示）
// ---------------------------------------------------------------
function ActiveToggle({
  userId,
  isActive,
  suspendReason,
  disabled,
}: {
  userId: string;
  isActive: boolean;
  suspendReason: SuspendReasonValue;
  disabled: boolean;
}) {
  const [isPending, setIsPending] = useState(false);
  const [active, setActive] = useState(isActive);
  const [currentReason, setCurrentReason] = useState<SuspendReasonValue>(suspendReason);
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  const performToggle = async (reason?: "MONTHLY_REPORT" | "ROYALTY_UNPAID" | "OTHER") => {
    setIsPending(true);
    const result = await toggleUserActive(userId, reason);
    if (result.success) {
      setActive(!active);
      setCurrentReason(active ? (reason ?? "OTHER") : null);
    }
    setIsPending(false);
    setShowReasonPicker(false);
  };

  const handleClick = () => {
    if (active) {
      // 稼働中 → 停止：理由選択モーダルを開く
      setShowReasonPicker(true);
    } else {
      // 停止中 → 復活
      if (window.confirm("このユーザーを復活させますか？")) {
        performToggle();
      }
    }
  };

  if (disabled) {
    return <span className="text-[10px] text-zinc-400">—</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
          active
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            : "bg-red-50 text-red-600 border-red-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
        } ${isPending ? "opacity-50" : ""}`}
        title={active ? "クリックで停止" : "クリックで復活"}
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : active ? "稼働中" : "停止中"}
      </button>

      {/* 停止理由の表示（停止中のみ） */}
      {!active && currentReason && (
        <span
          className={`ml-1 inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded border ${SUSPEND_REASON_COLOR[currentReason]}`}
        >
          {SUSPEND_REASON_LABEL[currentReason]}
        </span>
      )}

      {/* 理由選択モーダル */}
      {showReasonPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowReasonPicker(false)}>
          <div
            className="bg-white rounded-xl shadow-xl border border-zinc-200 p-5 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-zinc-900 mb-1">停止理由を選択</p>
            <p className="text-xs text-zinc-500 mb-4">このユーザーを停止する理由を選んでください</p>
            <div className="space-y-2">
              <button
                onClick={() => performToggle("ROYALTY_UNPAID")}
                disabled={isPending}
                className="w-full text-left px-3 py-2 text-sm rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 transition-colors"
              >
                <span className="font-semibold">ロイヤリティ未払い</span>
                <span className="block text-xs text-red-600 mt-0.5">入金確認後、本部が手動で復帰</span>
              </button>
              <button
                onClick={() => performToggle("MONTHLY_REPORT")}
                disabled={isPending}
                className="w-full text-left px-3 py-2 text-sm rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors"
              >
                <span className="font-semibold">月次報告未提出</span>
                <span className="block text-xs text-amber-600 mt-0.5">パートナーが報告提出で自動復帰</span>
              </button>
              <button
                onClick={() => performToggle("OTHER")}
                disabled={isPending}
                className="w-full text-left px-3 py-2 text-sm rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 transition-colors"
              >
                <span className="font-semibold">その他</span>
                <span className="block text-xs text-zinc-500 mt-0.5">本部の個別判断で停止</span>
              </button>
            </div>
            <button
              onClick={() => setShowReasonPicker(false)}
              className="mt-4 w-full text-xs text-zinc-500 hover:text-zinc-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
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
                ["状態",          "text-center"],
                ["機能許可",      "text-left"],
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

                  {/* 状態 */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <ActiveToggle userId={user.id} isActive={user.isActive} suspendReason={user.suspendReason} disabled={isSelf} />
                      {user.suspendCount > 0 && (
                        <span className="text-[10px] text-red-400 font-medium" title="累計停止回数">
                          {user.suspendCount}回
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 機能許可 */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {OPTIONAL_FEATURES.map((feat) => (
                        <FeatureToggle
                          key={feat.id}
                          userId={user.id}
                          featureId={feat.id}
                          label={feat.label}
                          enabled={user.enabledFeatures.includes(feat.id)}
                        />
                      ))}
                      <LearningExemptToggle userId={user.id} enabled={user.learningExempt} />
                    </div>
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
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-zinc-400">
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
