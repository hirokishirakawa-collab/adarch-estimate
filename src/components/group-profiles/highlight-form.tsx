"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";

interface CompanyOption {
  id: string;
  name: string;
  ownerName: string;
}

interface HighlightData {
  id: string;
  title: string;
  description: string;
  emoji: string | null;
  isActive: boolean;
  members: { groupCompany: { id: string } }[];
}

interface HighlightFormProps {
  companies: CompanyOption[];
  highlight?: HighlightData | null;
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  onDelete?: () => Promise<{ error?: string; success?: boolean }>;
}

export function HighlightForm({ companies, highlight, action, onDelete }: HighlightFormProps) {
  const router = useRouter();
  const isEdit = !!highlight;

  async function handleSubmit(_prev: unknown, formData: FormData) {
    const result = await action(formData);
    if (result?.success) {
      router.push("/dashboard/group-profiles/highlights");
      return null;
    }
    return result;
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, null);

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("この連携案件を削除しますか？")) return;
    const result = await onDelete();
    if (result?.success) {
      router.push("/dashboard/group-profiles/highlights");
    }
  }

  const selectedIds = highlight?.members.map((m) => m.groupCompany.id) ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/group-profiles/highlights"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          一覧に戻る
        </Link>
        {isEdit && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            削除
          </button>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-6">
          {isEdit ? "連携案件を編集" : "連携案件を作成"}
        </h2>

        {state?.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-xs text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-5">
          {/* 絵文字 */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              絵文字アイコン（任意）
            </label>
            <input
              type="text"
              name="emoji"
              defaultValue={highlight?.emoji ?? ""}
              placeholder="🤝"
              className="w-20 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            />
          </div>

          {/* タイトル */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              案件タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              defaultValue={highlight?.title ?? ""}
              placeholder="ワンピース案件"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
            />
          </div>

          {/* 詳細 */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              詳細 <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              required
              rows={3}
              defaultValue={highlight?.description ?? ""}
              placeholder="本部のワンピース案件を共同で推進中"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 resize-none"
            />
          </div>

          {/* メンバー選択 */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              連携メンバー（2人以上選択） <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-zinc-200 rounded-lg p-3">
              {companies.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    name="memberIds"
                    value={c.id}
                    defaultChecked={selectedIds.includes(c.id)}
                    className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-zinc-800">{c.ownerName}</span>
                  <span className="text-xs text-zinc-400 truncate">({c.name})</span>
                </label>
              ))}
            </div>
          </div>

          {/* 表示フラグ（編集時のみ） */}
          {isEdit && (
            <div>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={highlight?.isActive ?? true}
                  className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                />
                表示中（チェックを外すと非表示）
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 text-sm font-medium bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "保存中..." : isEdit ? "更新する" : "作成する"}
          </button>
        </form>
      </div>
    </div>
  );
}
