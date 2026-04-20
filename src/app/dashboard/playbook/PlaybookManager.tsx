"use client";

import { useState } from "react";
import {
  BookOpen,
  Sparkles,
  Download,
  Copy,
  Check,
  Save,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

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

const INDUSTRY_SUGGESTIONS = [
  "美容院", "飲食店", "工務店", "不動産", "歯科医院",
  "整骨院", "エステ", "自動車販売", "学習塾", "ホテル・旅館",
];

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
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  // 生成フォーム
  const [targetType, setTargetType] = useState("BTOC");
  const [industry, setIndustry] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [generatedApproach, setGeneratedApproach] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [exampleCount, setExampleCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // 編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPitch, setEditPitch] = useState("");
  const [editApproach, setEditApproach] = useState("");

  const guidelinesMap: Record<string, unknown> = {};
  for (const g of initialGuidelines) {
    guidelinesMap[g.key] = g.value;
  }

  // ── AI 生成 ──
  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedPitch("");
    setGeneratedApproach("");
    setGeneratedMessage(null);
    try {
      const res = await fetch("/api/auto-sales/playbook/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, industry: industry || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedPitch(data.pitchText ?? "");
        setGeneratedApproach(data.approach ?? "");
        setGeneratedMessage(data.message);
        setExampleCount(data.exampleCount ?? 0);
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── コピー ──
  const handleCopy = async () => {
    const text = generatedPitch + (generatedApproach ? `\n\n【効く理由】\n${generatedApproach}` : "");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── 生成結果を保存 ──
  const handleSave = async () => {
    if (!generatedPitch) return;
    setSaving(true);
    try {
      const label = industry
        ? `${industry}×${targetType === "BTOB" ? "BtoB" : "BtoC"}`
        : `汎用×${targetType === "BTOB" ? "BtoB" : "BtoC"}`;
      const res = await fetch("/api/auto-sales/playbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          targetType,
          industry: industry || null,
          serviceTypes: ["VIDEO_PRODUCTION", "AD_MEDIA"],
          pitchTemplate: generatedPitch,
          approach: generatedApproach || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setPlaybooks((prev) => [created, ...prev]);
        setGeneratedPitch("");
        setGeneratedApproach("");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── 編集保存 ──
  const handleEditSave = async (id: string) => {
    const res = await fetch(`/api/auto-sales/playbook/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitchTemplate: editPitch, approach: editApproach || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPlaybooks((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
      );
      setEditingId(null);
    }
  };

  // ── 削除 ──
  const handleDelete = async (id: string) => {
    if (!confirm("この営業文を削除しますか？")) return;
    const res = await fetch(`/api/auto-sales/playbook/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlaybooks((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // ── JSON ダウンロード ──
  const handleDownload = async () => {
    const res = await fetch("/api/auto-sales/playbook");
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
              グループ全体の営業実績から、効果的な営業文をAIが生成
            </p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          JSON
        </button>
      </div>

      {/* ── 生成パネル ── */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          実績ベースで営業文を生成
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">ターゲット</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="BTOC">BtoC（個人・店舗）</option>
              <option value="BTOB">BtoB（法人）</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-600 mb-1">業種（空欄で汎用）</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="例: 美容院"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {INDUSTRY_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setIndustry(s)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    industry === s
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-500 border-zinc-200 hover:border-emerald-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? "生成中..." : "生成する"}
          </button>
        </div>

        {/* 生成結果 */}
        {generatedMessage && !generatedPitch && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            {generatedMessage}
          </div>
        )}

        {generatedPitch && (
          <div className="space-y-3 mt-2">
            <div className="bg-white rounded-lg border border-zinc-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-emerald-600">
                  生成結果（{exampleCount}件の実績データから生成）
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? "コピー済み" : "コピー"}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3 h-3" />
                      {saving ? "保存中..." : "保存"}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                {generatedPitch}
              </p>
            </div>
            {generatedApproach && (
              <div className="bg-amber-50/60 rounded-lg border border-amber-200/50 p-3">
                <p className="text-xs font-medium text-amber-600 mb-1">この営業文が効く理由</p>
                <p className="text-sm text-zinc-700">{generatedApproach}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ガイドライン */}
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

      {/* ── 保存済み営業文一覧 ── */}
      {playbooks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-600 mb-3">保存済みの営業文</h2>
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
                        onClick={() => {
                          setEditingId(p.id);
                          setEditPitch(p.pitchTemplate);
                          setEditApproach(p.approach ?? "");
                        }}
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

                {editingId === p.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={editPitch}
                      onChange={(e) => setEditPitch(e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <textarea
                      value={editApproach}
                      onChange={(e) => setEditApproach(e.target.value)}
                      rows={2}
                      placeholder="効く理由（任意）"
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleEditSave(p.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-zinc-50 rounded-lg p-3">
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap">{p.pitchTemplate}</p>
                    </div>
                    {p.approach && (
                      <div className="bg-amber-50/50 rounded-lg p-3">
                        <p className="text-xs font-medium text-amber-600 mb-1">効く理由</p>
                        <p className="text-sm text-zinc-700">{p.approach}</p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-400">
                    {new Date(p.updatedAt).toLocaleDateString("ja-JP")}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {p.serviceTypes.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                      >
                        {SERVICE_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
