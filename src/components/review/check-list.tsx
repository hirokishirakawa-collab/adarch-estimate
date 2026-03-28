"use client";

import { useState, useActionState, useCallback } from "react";
import {
  Plus,
  Check,
  CheckCheck,
  Clock,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  addCheckItem,
  applyCheckItem,
  unapplyCheckItem,
  confirmCheckItem,
  unconfirmCheckItem,
  deleteCheckItem,
} from "@/lib/actions/review-checklist";

export interface CheckItem {
  id: string;
  description: string;
  timecode: number | null;
  sortOrder: number;
  appliedAt: string | null;
  appliedBy: string | null;
  appliedById: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmedById: string | null;
  createdBy: string;
}

interface Props {
  reviewId: string;
  items: CheckItem[];
  currentTime: number;
  onSeek: (timecode: number) => void;
}

function formatTC(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CheckList({ reviewId, items, currentTime, onSeek }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [addState, addAction, isAdding] = useActionState(addCheckItem, null);
  const [actionError, setActionError] = useState<string | null>(null);

  const completed = items.filter((i) => i.confirmedAt).length;
  const applied = items.filter((i) => i.appliedAt).length;
  const total = items.length;

  const handleApply = useCallback(async (id: string, isApplied: boolean) => {
    setActionError(null);
    const result = isApplied
      ? await unapplyCheckItem(id)
      : await applyCheckItem(id);
    if (result.error) setActionError(result.error);
  }, []);

  const handleConfirm = useCallback(async (id: string, isConfirmed: boolean) => {
    setActionError(null);
    const result = isConfirmed
      ? await unconfirmCheckItem(id)
      : await confirmCheckItem(id);
    if (result.error) setActionError(result.error);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setActionError(null);
    const result = await deleteCheckItem(id);
    if (result.error) setActionError(result.error);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70">
          修正チェックリスト
        </h3>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs text-zinc-500">
              反映 {applied}/{total} ・ 確認 {completed}/{total}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            追加
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* 進捗バー */}
      {total > 0 && (
        <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-zinc-800">
          <div
            className="bg-emerald-500 transition-all duration-300"
            style={{ width: `${(completed / total) * 100}%` }}
          />
          <div
            className="bg-amber-500 transition-all duration-300"
            style={{ width: `${((applied - completed) / total) * 100}%` }}
          />
        </div>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <form
          action={async (formData: FormData) => {
            await addAction(formData);
            setShowForm(false);
          }}
          className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-2"
        >
          <input type="hidden" name="reviewId" value={reviewId} />
          <input type="hidden" name="timecode" value={currentTime.toString()} />
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            TC: {formatTC(currentTime)}
          </div>
          <textarea
            name="description"
            rows={2}
            required
            placeholder="修正内容を入力（例: 「お届け」→「お届けします」に変更）"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors resize-none"
          />
          {addState?.error && (
            <p className="text-red-400 text-xs">{addState.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isAdding}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium border border-amber-500/20 hover:bg-amber-500/25 disabled:opacity-40 transition-colors"
            >
              {isAdding ? "追加中..." : "追加"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* チェック項目一覧 */}
      {total === 0 ? (
        <div className="text-center py-6 text-zinc-600 text-xs">
          修正依頼を追加してチェックリストを作成
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <CheckItemRow
              key={item.id}
              item={item}
              onSeek={onSeek}
              onApply={handleApply}
              onConfirm={handleConfirm}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckItemRow({
  item,
  onSeek,
  onApply,
  onConfirm,
  onDelete,
}: {
  item: CheckItem;
  onSeek: (tc: number) => void;
  onApply: (id: string, isApplied: boolean) => void;
  onConfirm: (id: string, isConfirmed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isApplied = !!item.appliedAt;
  const isConfirmed = !!item.confirmedAt;

  return (
    <div
      className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl border transition-all ${
        isConfirmed
          ? "bg-emerald-500/5 border-emerald-500/15"
          : isApplied
            ? "bg-amber-500/5 border-amber-500/15"
            : "bg-white/[0.02] border-white/5"
      }`}
    >
      {/* ステータスアイコン */}
      <div className="flex-shrink-0 pt-0.5">
        {isConfirmed ? (
          <CheckCheck className="w-4 h-4 text-emerald-500" />
        ) : isApplied ? (
          <Check className="w-4 h-4 text-amber-500" />
        ) : (
          <div className="w-4 h-4 rounded border border-zinc-600" />
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${isConfirmed ? "text-zinc-500 line-through" : "text-white/80"}`}>
          {item.description}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {item.timecode !== null && (
            <button
              type="button"
              onClick={() => onSeek(item.timecode!)}
              className="text-xs text-amber-500/70 hover:text-amber-400 font-mono transition-colors"
            >
              {formatTC(item.timecode)}
            </button>
          )}
          {isApplied && (
            <span className="text-xs text-amber-400/60">
              反映: {item.appliedBy}
            </span>
          )}
          {isConfirmed && (
            <span className="text-xs text-emerald-400/60">
              確認: {item.confirmedBy}
            </span>
          )}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* 反映チェック */}
        <button
          type="button"
          onClick={() => onApply(item.id, isApplied)}
          title={isApplied ? "反映を取消" : "反映済み"}
          className={`p-1.5 rounded-lg text-xs transition-colors ${
            isApplied
              ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              : "bg-zinc-800 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>

        {/* 確認チェック（反映済みの場合のみ有効） */}
        <button
          type="button"
          onClick={() => onConfirm(item.id, isConfirmed)}
          disabled={!isApplied}
          title={isConfirmed ? "確認を取消" : "確認OK"}
          className={`p-1.5 rounded-lg text-xs transition-colors disabled:opacity-20 disabled:cursor-not-allowed ${
            isConfirmed
              ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
              : "bg-zinc-800 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          <CheckCheck className="w-3.5 h-3.5" />
        </button>

        {/* 削除 */}
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          title="削除"
          className="p-1.5 rounded-lg bg-zinc-800 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
