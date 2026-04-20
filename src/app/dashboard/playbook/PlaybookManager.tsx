"use client";

import { useState } from "react";
import { BookOpen, Plus, Pencil, Trash2, Download, ChevronDown, ChevronRight } from "lucide-react";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
interface PlaybookEntry {
  id: string;
  label: string;
  targetType: string;
  industry: string | null;
  serviceTypes: string[];
  pitchTemplate: string;
  approach: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GuidelineEntry {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

interface Props {
  initialPlaybooks: PlaybookEntry[];
  initialGuidelines: GuidelineEntry[];
  isAdmin: boolean;
}

const SERVICE_LABELS: Record<string, string> = {
  VIDEO_PRODUCTION: "動画制作",
  SNS_MANAGEMENT: "SNS運用",
  AD_MEDIA: "広告媒体提案",
  FIRST_MEETING: "初回商談",
};

const DEFAULT_GUIDELINES: Record<string, unknown> = {
  brand: "Ad Arch株式会社 加盟パートナー",
  positioning: "地方の事業を全国的にPR",
  availableMedia: ["TVer", "Eion Cinema", "タクシー広告", "YouTube", "SNS"],
  tone: "丁寧・提案型・押し売りしない",
  prohibited: [
    "競合他社名の言及",
    "他社の制作実績・事例への言及",
    "クライアント名の使用",
    "アドアーチ本部を騙る表現",
    "虚偽の表現",
  ],
};

// ----------------------------------------------------------------
// メインコンポーネント
// ----------------------------------------------------------------
export function PlaybookManager({ initialPlaybooks, initialGuidelines, isAdmin }: Props) {
  const [playbooks, setPlaybooks] = useState<PlaybookEntry[]>(initialPlaybooks);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // フォーム state
  const [form, setForm] = useState({
    label: "",
    targetType: "BTOC",
    industry: "",
    serviceTypes: ["VIDEO_PRODUCTION"] as string[],
    pitchTemplate: "",
    approach: "",
  });

  // guidelines を key-value オブジェクトに
  const guidelinesMap: Record<string, unknown> = {};
  for (const g of initialGuidelines) {
    guidelinesMap[g.key] = g.value;
  }

  const resetForm = () => {
    setForm({
      label: "",
      targetType: "BTOC",
      industry: "",
      serviceTypes: ["VIDEO_PRODUCTION"],
      pitchTemplate: "",
      approach: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: PlaybookEntry) => {
    setForm({
      label: p.label,
      targetType: p.targetType,
      industry: p.industry ?? "",
      serviceTypes: p.serviceTypes,
      pitchTemplate: p.pitchTemplate,
      approach: p.approach ?? "",
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/auto-sales/playbook/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const updated = await res.json();
          setPlaybooks((prev) =>
            prev.map((p) => (p.id === editingId ? { ...p, ...updated } : p))
          );
          resetForm();
        }
      } else {
        const res = await fetch("/api/auto-sales/playbook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          const created = await res.json();
          setPlaybooks((prev) => [created, ...prev]);
          resetForm();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このプレイブックを無効化しますか？")) return;
    const res = await fetch(`/api/auto-sales/playbook/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPlaybooks((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleDownload = async () => {
    const res = await fetch("/api/auto-sales/playbook");
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleService = (svc: string) => {
    setForm((prev) => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(svc)
        ? prev.serviceTypes.filter((s) => s !== svc)
        : [...prev.serviceTypes, svc],
    }));
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-800">営業プレイブック</h1>
            <p className="text-sm text-zinc-500">
              {isAdmin
                ? "効果的な訴求パターンを管理し、パートナーに配信"
                : "本部が検証済みの訴求パターンを確認・ダウンロード"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              追加
            </button>
          )}
        </div>
      </div>

      {/* ガイドライン表示 */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <button
          onClick={() => setGuidelinesOpen(!guidelinesOpen)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <span>ガイドライン（禁止事項・ブランドルール）</span>
          {guidelinesOpen ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
        </button>
        {guidelinesOpen && (
          <div className="px-5 pb-4 border-t border-zinc-100 space-y-3 pt-3">
            {Object.entries(
              Object.keys(guidelinesMap).length > 0 ? guidelinesMap : DEFAULT_GUIDELINES
            ).map(([key, value]) => (
              <div key={key}>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  {key}
                </span>
                <div className="mt-1 text-sm text-zinc-700">
                  {Array.isArray(value) ? (
                    <ul className="list-disc list-inside space-y-0.5">
                      {(value as string[]).map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{String(value)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 作成/編集フォーム（ADMIN） */}
      {isAdmin && showForm && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-700">
            {editingId ? "プレイブック編集" : "新規プレイブック作成"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">ラベル</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="例: 美容院×動画制作"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">ターゲット種別</label>
              <select
                value={form.targetType}
                onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="BTOC">BtoC</option>
                <option value="BTOB">BtoB</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">対象業種（任意）</label>
            <input
              type="text"
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="例: 美容院、飲食店、工務店"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">訴求カテゴリ</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SERVICE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleService(key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    form.serviceTypes.includes(key)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-emerald-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              訴求文テンプレート
            </label>
            <textarea
              value={form.pitchTemplate}
              onChange={(e) => setForm((f) => ({ ...f, pitchTemplate: e.target.value }))}
              rows={4}
              placeholder="御社の{companyInsight}、TVer配信による地域認知向上をご提案させていただきたく..."
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <p className="mt-1 text-xs text-zinc-400">
              利用可能な変数: {"{companyInsight}"}, {"{industry}"}, {"{area}"}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              アプローチのコツ（任意）
            </label>
            <textarea
              value={form.approach}
              onChange={(e) => setForm((f) => ({ ...f, approach: e.target.value }))}
              rows={2}
              placeholder="店舗リニューアル・新メニュー導入のタイミングに合わせて提案すると効果的"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !form.label || !form.pitchTemplate}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : editingId ? "更新" : "作成"}
            </button>
          </div>
        </div>
      )}

      {/* プレイブック一覧 */}
      {playbooks.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-zinc-400 text-sm">
          プレイブックがまだありません
        </div>
      ) : (
        <div className="space-y-3">
          {playbooks.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-800">{p.label}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.targetType === "BTOB"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {p.targetType === "BTOB" ? "BtoB" : "BtoC"}
                  </span>
                  {p.industry && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                      {p.industry}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {p.serviceTypes.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                  >
                    {SERVICE_LABELS[s] ?? s}
                  </span>
                ))}
              </div>

              <div className="bg-zinc-50 rounded-lg p-3">
                <p className="text-xs font-medium text-zinc-500 mb-1">訴求文テンプレート</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{p.pitchTemplate}</p>
              </div>

              {p.approach && (
                <div className="bg-amber-50/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-600 mb-1">アプローチのコツ</p>
                  <p className="text-sm text-zinc-700">{p.approach}</p>
                </div>
              )}

              <p className="text-[10px] text-zinc-400">
                更新: {new Date(p.updatedAt).toLocaleDateString("ja-JP")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
