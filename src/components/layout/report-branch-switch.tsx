"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { switchReportBranch } from "@/lib/actions/report-branch";

export type ReportBranches = {
  current: { id: string; name: string };
  other: { id: string; name: string };
};

// 2拠点の代表だけに出す「報告先」切替。押した県が以後の登録先になる
export function ReportBranchSwitch({ branches }: { branches: ReportBranches }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 表示順は名前順で固定（押すたびに左右が入れ替わらないように）
  const items = [branches.current, branches.other].sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const select = (id: string, name: string) => {
    if (id === branches.current.id || pending) return;
    startTransition(async () => {
      const res = await switchReportBranch(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`報告先を${name}に切り替えました。これからの登録は${name}で記録されます`);
      router.refresh();
    });
  };

  return (
    <div
      className="flex items-center gap-1.5"
      title="商談・送付・リード操作・月次報告・AI連携の記録が、選んだ県で登録されます（見える範囲は両県分のまま）"
    >
      <span className="hidden sm:block text-[11px] text-zinc-500">報告先</span>
      <div className={cn("flex rounded-lg bg-zinc-100 p-0.5", pending && "opacity-60")}>
        {items.map((b) => {
          const active = b.id === branches.current.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => select(b.id, b.name)}
              disabled={pending}
              aria-pressed={active}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs transition-colors",
                active ? "bg-white text-zinc-900 font-semibold shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              {b.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
