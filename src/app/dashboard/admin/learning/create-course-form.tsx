"use client";

import { useState, useTransition } from "react";
import { createCourse } from "@/lib/actions/learning";

export function CreateCourseForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("onboard");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createCourse({ title: title.trim(), description: description.trim() || undefined, category });
      setTitle("");
      setDescription("");
      setCategory("onboard");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_150px_auto] gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="コース名（例：媒体A 取扱テスト）"
        className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
        required
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="説明（任意）"
        className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
      >
        <option value="onboard">オンボード</option>
        <option value="media">媒体テスト</option>
        <option value="advanced">上級</option>
      </select>
      <button
        type="submit"
        disabled={isPending || !title.trim()}
        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
      >
        {isPending ? "作成中…" : "作成"}
      </button>
    </form>
  );
}
