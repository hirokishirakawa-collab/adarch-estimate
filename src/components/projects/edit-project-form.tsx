"use client";

import { useActionState, useState } from "react";
import { updateProject } from "@/lib/actions/project";
import { PROJECT_STATUS_OPTIONS } from "@/lib/constants/projects";
import { Loader2, Save } from "lucide-react";
import type { Project, Customer } from "@/generated/prisma/client";

interface Props {
  project: Project & { customer?: { id: string; name: string } | null };
  customers: Pick<Customer, "id" | "name">[];
}

export function EditProjectForm({ project, customers }: Props) {
  const boundAction = updateProject.bind(null, project.id);
  const [state, formAction, isPending] = useActionState(boundAction, null);
  const [status, setStatus] = useState(project.status);

  const deadlineStr = project.deadline
    ? new Date(project.deadline).toISOString().split("T")[0]
    : "";

  return (
    <form action={formAction} className="space-y-5">
      {/* プロジェクト名 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
          プロジェクト名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="title"
          required
          maxLength={100}
          defaultValue={project.title}
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* ステータス */}
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
          ステータス
        </label>
        <input type="hidden" name="status" value={status} />
        <div className="flex flex-wrap gap-2">
          {PROJECT_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value as typeof status)}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors ${
                status === opt.value
                  ? opt.className
                  : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 納期 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
            納期
          </label>
          <input
            type="date"
            name="deadline"
            defaultValue={deadlineStr}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* 担当者 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
            担当者
          </label>
          <input
            type="text"
            name="staffName"
            defaultValue={project.staffName ?? ""}
            placeholder="例: 山田 太郎"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* 顧客 */}
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
            関連顧客
          </label>
          <select
            name="customerId"
            defaultValue={project.customerId ?? ""}
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">（なし）</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 概要 */}
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
          概要・説明
        </label>
        <textarea
          name="description"
          rows={4}
          defaultValue={project.description ?? ""}
          placeholder="プロジェクトの概要・背景など"
          className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存する
        </button>
        <p className="text-xs text-zinc-400">変更した項目は自動的にログに記録されます</p>
      </div>
    </form>
  );
}
