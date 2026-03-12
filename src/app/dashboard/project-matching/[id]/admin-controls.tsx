"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye, Trash2 } from "lucide-react";
import {
  toggleProjectHidden,
  deleteProjectRequest,
} from "@/lib/actions/project-matching";

export function AdminControls({
  projectRequestId,
  isHidden,
  title,
}: {
  projectRequestId: string;
  isHidden: boolean;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleToggleHidden = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleProjectHidden(projectRequestId);
      if (res.error) setError(res.error);
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteProjectRequest(projectRequestId);
      if (res.error) {
        setError(res.error);
      } else {
        router.push("/dashboard/project-matching");
      }
    });
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-xs font-semibold text-amber-800 mb-3">
        管理者メニュー
      </h3>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700 mb-3">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleHidden}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${
            isHidden
              ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
              : "text-amber-700 bg-white border-amber-300 hover:bg-amber-100"
          }`}
        >
          {isHidden ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              公開に戻す
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              非公開にする
            </>
          )}
        </button>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            削除
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">
              「{title.slice(0, 15)}
              {title.length > 15 ? "…" : ""}」を削除しますか？
            </span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "削除中…" : "削除する"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isPending}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>

      {isHidden && (
        <p className="text-[11px] text-amber-600 mt-2">
          この案件は非公開です。一覧に表示されません。
        </p>
      )}
    </div>
  );
}
