"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save, Play, FileText, Type } from "lucide-react";
import { createLesson, updateLesson, deleteLesson } from "@/lib/actions/learning";

type Lesson = {
  id: string;
  courseId: string;
  title: string;
  type: string;
  contentUrl: string | null;
  body: string | null;
  durationMin: number | null;
  sortOrder: number;
};

export function LessonSection({ courseId, lessons }: { courseId: string; lessons: Lesson[] }) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-zinc-800">教材（レッスン）</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          レッスン追加
        </button>
      </div>

      {showCreate && (
        <CreateLessonForm
          courseId={courseId}
          nextOrder={(lessons.at(-1)?.sortOrder ?? -1) + 1}
          onDone={() => setShowCreate(false)}
        />
      )}

      <div className="space-y-2">
        {lessons.length === 0 && !showCreate ? (
          <div className="bg-zinc-50 rounded-xl border border-dashed border-zinc-200 p-8 text-center">
            <p className="text-sm text-zinc-500">レッスンがまだありません</p>
          </div>
        ) : (
          lessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} />)
        )}
      </div>
    </section>
  );
}

function typeIcon(type: string) {
  if (type === "video") return <Play className="w-3.5 h-3.5" />;
  if (type === "pdf") return <FileText className="w-3.5 h-3.5" />;
  return <Type className="w-3.5 h-3.5" />;
}

function CreateLessonForm({
  courseId,
  nextOrder,
  onDone,
}: {
  courseId: string;
  nextOrder: number;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("video");
  const [contentUrl, setContentUrl] = useState("");
  const [durationMin, setDurationMin] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await createLesson({
        courseId,
        title: title.trim(),
        type,
        contentUrl: contentUrl.trim() || undefined,
        durationMin: durationMin ? Number(durationMin) : undefined,
        sortOrder: nextOrder,
      });
      onDone();
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 mb-3 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px] gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="レッスン名"
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        >
          <option value="video">動画</option>
          <option value="pdf">PDF</option>
          <option value="text">テキスト</option>
        </select>
        <input
          type="number"
          value={durationMin}
          onChange={(e) => setDurationMin(e.target.value)}
          placeholder="分"
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
      </div>
      <input
        type="url"
        value={contentUrl}
        onChange={(e) => setContentUrl(e.target.value)}
        placeholder="URL（動画/PDFの場合）"
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
        >
          {isPending ? "追加中…" : "追加"}
        </button>
      </div>
    </form>
  );
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState(lesson.type);
  const [contentUrl, setContentUrl] = useState(lesson.contentUrl ?? "");
  const [durationMin, setDurationMin] = useState<string>(lesson.durationMin?.toString() ?? "");
  const [sortOrder, setSortOrder] = useState(lesson.sortOrder);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function onSave() {
    startSave(async () => {
      await updateLesson(lesson.id, {
        title: title.trim(),
        type,
        contentUrl: contentUrl.trim() || null,
        durationMin: durationMin ? Number(durationMin) : null,
        sortOrder,
      });
      setEditing(false);
    });
  }

  function onDelete() {
    if (!confirm(`「${lesson.title}」を削除しますか？`)) return;
    startDelete(async () => {
      await deleteLesson(lesson.id);
    });
  }

  if (!editing) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-zinc-50 border flex items-center justify-center text-[10px] font-bold text-zinc-500">
          {lesson.sortOrder}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
              {typeIcon(lesson.type)}
              {lesson.type}
            </span>
            <h4 className="text-sm font-bold text-zinc-800 truncate">{lesson.title}</h4>
            {lesson.durationMin != null && (
              <span className="text-[11px] text-zinc-400">約{lesson.durationMin}分</span>
            )}
          </div>
          {lesson.contentUrl && (
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{lesson.contentUrl}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="px-2.5 py-1 text-[11px] font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors"
        >
          編集
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-50"
          title="削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-blue-300 rounded-xl p-4 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_80px_80px] gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        >
          <option value="video">動画</option>
          <option value="pdf">PDF</option>
          <option value="text">テキスト</option>
        </select>
        <input
          type="number"
          value={durationMin}
          onChange={(e) => setDurationMin(e.target.value)}
          placeholder="分"
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          placeholder="順"
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <input
        type="url"
        value={contentUrl}
        onChange={(e) => setContentUrl(e.target.value)}
        placeholder="URL"
        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
