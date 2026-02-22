"use client";

import { startTransition } from "react";
import { deleteExpense } from "@/lib/actions/project";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/constants/expenses";
import type { Expense, ExpenseCategory } from "@/generated/prisma/client";
import { Trash2 } from "lucide-react";

interface Props {
  expenses: Expense[];
  projectId: string;
}

function getCategoryLabel(cat: ExpenseCategory): string {
  return EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day:   "numeric",
  }).format(new Date(date));
}

export function ExpenseList({ expenses, projectId }: Props) {
  const totalAmount = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  if (expenses.length === 0) {
    return (
      <p className="text-xs text-zinc-400 text-center py-6">
        経費は登録されていません
      </p>
    );
  }

  const handleDelete = (expenseId: string) => {
    if (!confirm("この経費を削除しますか？")) return;
    startTransition(async () => {
      await deleteExpense(expenseId, projectId);
    });
  };

  return (
    <div className="space-y-1">
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 group border border-transparent hover:border-zinc-200 transition-all"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-zinc-700 truncate">{expense.title}</p>
              <span className="flex-shrink-0 text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                {getCategoryLabel(expense.category)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-zinc-400">{formatDate(expense.date)}</p>
              {expense.notes && (
                <p className="text-[10px] text-zinc-400 truncate">{expense.notes}</p>
              )}
            </div>
          </div>

          <p className="text-sm font-semibold text-zinc-800 flex-shrink-0">
            ¥{Number(expense.amount).toLocaleString()}
          </p>

          <button
            onClick={() => handleDelete(expense.id)}
            className="flex-shrink-0 p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            title="削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* 合計 */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 mt-2">
        <p className="text-xs font-semibold text-zinc-500">合計</p>
        <p className="text-sm font-bold text-zinc-900">
          ¥{totalAmount.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
