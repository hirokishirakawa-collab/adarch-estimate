"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Eye, EyeOff } from "lucide-react";
import { updateCourse, deleteCourse, toggleCoursePublished } from "@/lib/actions/learning";

type Course = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  sortOrder: number;
  published: boolean;
  mediaType: string | null;
};

const MEDIA_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "（媒体紐付けなし）" },
  { value: "TVER", label: "TVer" },
  { value: "CINE_AD", label: "シネアド（イオンシネマ）" },
  { value: "DIGITAL_SIGNAGE", label: "デジタルサイネージ" },
  { value: "TAXI", label: "タクシー広告" },
  { value: "APA_HOTEL", label: "アパホテル" },
  { value: "UNIVERSITY", label: "大学広告" },
  { value: "SKYLARK", label: "すかいらーく広告" },
  { value: "GOLF_CART", label: "ゴルフカート" },
  { value: "ACQUISITION", label: "取得依頼" },
  { value: "OTHER", label: "その他" },
];

export function CourseEditor({ course }: { course: Course }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [category, setCategory] = useState(course.category);
  const [sortOrder, setSortOrder] = useState(course.sortOrder);
  const [mediaType, setMediaType] = useState<string>(course.mediaType ?? "");
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isToggling, startToggle] = useTransition();

  function onSave() {
    startSave(async () => {
      await updateCourse(course.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
        sortOrder,
        mediaType: mediaType || null,
      });
    });
  }

  function onDelete() {
    if (!confirm(`コース「${course.title}」を削除します。\n関連するレッスン・テスト・受講履歴もすべて削除されます。よろしいですか？`)) return;
    startDelete(async () => {
      await deleteCourse(course.id);
      router.push("/dashboard/admin/learning");
    });
  }

  function onTogglePublish() {
    startToggle(async () => {
      await toggleCoursePublished(course.id);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-zinc-900">コース編集</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={isToggling}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              course.published
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
            } disabled:opacity-50`}
          >
            {course.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {course.published ? "公開中" : "非公開"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            削除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-zinc-600 mb-1.5">コース名</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-zinc-600 mb-1.5">説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-600 mb-1.5">カテゴリ</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          >
            <option value="onboard">オンボード</option>
            <option value="media">媒体テスト</option>
            <option value="advanced">上級</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-600 mb-1.5">並び順</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-zinc-600 mb-1.5">
            紐付く媒体
            <span className="font-normal text-zinc-400 ml-1">
              （このコース合格で販売権限が付与される媒体）
            </span>
          </label>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          >
            {MEDIA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !title.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
