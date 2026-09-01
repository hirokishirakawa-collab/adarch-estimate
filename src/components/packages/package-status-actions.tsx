"use client";

// 本部だけの操作: 承認（稼働中へ）／終了／復帰／削除。起案者は自分の提案中だけ削除できる
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, RotateCcw, Trash2, XCircle } from "lucide-react";
import { deletePackage, setPackageStatus } from "@/lib/actions/packages";
import type { SalesPackageStatus } from "@/generated/prisma/client";

export function PackageStatusActions({
  id,
  status,
  isAdmin,
  canDelete,
  hasPrice,
}: {
  id: string;
  status: SalesPackageStatus;
  isAdmin: boolean;
  canDelete: boolean;
  hasPrice: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function move(next: SalesPackageStatus, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      const r = await setPackageStatus(id, next);
      setErr(r.error ?? null);
    });
  }
  function remove() {
    if (!confirm("このパッケージを削除します。送付・事例の記録は残りますが、紐づけは外れます。よろしいですか？")) return;
    start(async () => {
      const r = await deletePackage(id);
      if (r?.error) setErr(r.error);
    });
  }

  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && status === "PROPOSED" && (
        <button
          onClick={() => move("ACTIVE", hasPrice ? undefined : "価格が未設定のまま稼働中にします。営業フォームには「価格未設定」で並びます。よろしいですか？")}
          disabled={pending}
          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          承認して稼働中にする
        </button>
      )}
      {isAdmin && status === "ACTIVE" && (
        <button onClick={() => move("RETIRED", "このパッケージを終了します。営業フォーム・見積からは消え、記録は残ります。")} disabled={pending} className={`${btn} bg-zinc-600 text-white hover:bg-zinc-700`}>
          <XCircle className="w-3.5 h-3.5" />終了にする
        </button>
      )}
      {isAdmin && status === "RETIRED" && (
        <button onClick={() => move("ACTIVE")} disabled={pending} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
          <RotateCcw className="w-3.5 h-3.5" />稼働中に戻す
        </button>
      )}
      {isAdmin && status === "ACTIVE" && (
        <button onClick={() => move("PROPOSED")} disabled={pending} className={`${btn} border border-zinc-300 text-zinc-600 hover:bg-zinc-50`}>
          提案中に戻す
        </button>
      )}
      {canDelete && (
        <button onClick={remove} disabled={pending} className={`${btn} border border-red-200 text-red-600 hover:bg-red-50`}>
          <Trash2 className="w-3.5 h-3.5" />削除
        </button>
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
