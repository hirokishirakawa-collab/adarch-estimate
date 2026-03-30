"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Plus,
  Rocket,
  Target,
  FileText,
  Sparkles,
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  Phone,
  MessageSquare,
  User,
  Mail,
  Calendar,
  ChevronDown,
} from "lucide-react";

const TARGET_TYPE_LABELS: Record<string, string> = {
  BTOB: "BtoB（法人向け）",
  BTOC: "BtoC（個人・店舗向け）",
};

const SERVICE_TYPE_OPTIONS = [
  { id: "VIDEO_PRODUCTION", label: "動画制作", icon: "🎬" },
  { id: "SNS_MANAGEMENT", label: "SNS運用", icon: "📱" },
  { id: "AD_MEDIA", label: "広告媒体提案", icon: "📊" },
  { id: "FIRST_MEETING", label: "初回商談", icon: "🤝" },
] as const;

interface Template {
  id: string;
  name: string;
  companyName: string;
  senderName: string;
  targetType: string;
  serviceTypes: string[];
  pitchText: string;
  isApproved: boolean;
  branch: { name: string } | null;
}

export function AutoSalesRequestForm({
  templates,
  targetCount,
  isAdmin,
  branchName,
}: {
  templates: Template[];
  targetCount: number;
  isAdmin: boolean;
  branchName: string;
}) {
  const [activeTab, setActiveTab] = useState<"target" | "template">("target");

  return (
    <div className="min-h-[80vh]">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8 md:p-10 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-purple-500/10" />
        <div className="absolute top-4 right-4 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-4 left-4 w-24 h-24 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                自動営業依頼
              </h1>
              <p className="text-zinc-400 text-sm">
                AI が問い合わせフォームに自動送信します
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">登録済み営業先</p>
                <p className="text-lg font-bold text-white">{targetCount}</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">営業テンプレート</p>
                <p className="text-lg font-bold text-white">{templates.length}</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">拠点</p>
                <p className="text-lg font-bold text-white">{branchName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab("target")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl border-2 transition-all duration-200 ${
            activeTab === "target"
              ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-500/10"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            activeTab === "target"
              ? "bg-blue-500 shadow-md shadow-blue-500/30"
              : "bg-zinc-100"
          }`}>
            <Target className={`w-5 h-5 ${activeTab === "target" ? "text-white" : "text-zinc-400"}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${activeTab === "target" ? "text-blue-700" : "text-zinc-700"}`}>
              営業先を追加
            </p>
            <p className={`text-xs ${activeTab === "target" ? "text-blue-500" : "text-zinc-400"}`}>
              フォームURLと企業情報を登録
            </p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("template")}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl border-2 transition-all duration-200 ${
            activeTab === "template"
              ? "border-purple-500 bg-purple-50 shadow-sm shadow-purple-500/10"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            activeTab === "template"
              ? "bg-purple-500 shadow-md shadow-purple-500/30"
              : "bg-zinc-100"
          }`}>
            <FileText className={`w-5 h-5 ${activeTab === "template" ? "text-white" : "text-zinc-400"}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${activeTab === "template" ? "text-purple-700" : "text-zinc-700"}`}>
              営業テンプレート
            </p>
            <p className={`text-xs ${activeTab === "template" ? "text-purple-500" : "text-zinc-400"}`}>
              訴求内容と送信者情報を設定
            </p>
          </div>
        </button>
      </div>

      {/* Content */}
      {activeTab === "target" ? (
        <AddTargetSection />
      ) : (
        <TemplateSection templates={templates} isAdmin={isAdmin} />
      )}
    </div>
  );
}

// ─── 営業先追加セクション ─────────────────────
function AddTargetSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const data = {
      companyName: fd.get("companyName"),
      url: fd.get("url"),
      industry: fd.get("industry"),
      area: fd.get("area"),
      phone: fd.get("phone"),
      note: fd.get("note"),
    };

    try {
      const res = await fetch("/api/auto-sales/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "登録に失敗しました");
        return;
      }
      setSuccess(true);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 mb-2">登録完了</h3>
        <p className="text-sm text-zinc-500 mb-6">営業先が追加されました。テンプレートと紐付けて自動営業を開始できます。</p>
        <button
          onClick={() => setSuccess(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          続けて追加する
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="p-6 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white">
        <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          営業先を登録
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          営業対象企業の問い合わせフォームURLと基本情報を入力してください
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* 企業名 */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Building2 className="w-4 h-4 text-zinc-400" />
            企業名 <span className="text-red-500">*</span>
          </label>
          <input
            name="companyName"
            required
            placeholder="例: 徳島美容室 hair salon Kaze"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>

        {/* フォームURL */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Globe className="w-4 h-4 text-zinc-400" />
            問い合わせフォームURL <span className="text-red-500">*</span>
          </label>
          <input
            name="url"
            type="url"
            required
            placeholder="https://example.com/contact"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>

        {/* 業種 + エリア */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
              <Sparkles className="w-4 h-4 text-zinc-400" />
              業種
            </label>
            <input
              name="industry"
              placeholder="例: 美容室"
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-300"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
              <MapPin className="w-4 h-4 text-zinc-400" />
              エリア
            </label>
            <input
              name="area"
              placeholder="例: 徳島"
              className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-300"
            />
          </div>
        </div>

        {/* 電話番号 */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Phone className="w-4 h-4 text-zinc-400" />
            電話番号
          </label>
          <input
            name="phone"
            placeholder="例: 088-XXX-XXXX"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>

        {/* メモ */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            メモ
          </label>
          <textarea
            name="note"
            rows={3}
            placeholder="営業時の参考情報があれば記入してください"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none placeholder:text-zinc-300"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            "登録中..."
          ) : (
            <>
              営業先を登録
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── テンプレートセクション ─────────────────────
function TemplateSection({
  templates,
  isAdmin,
}: {
  templates: Template[];
  isAdmin: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      {/* テンプレート一覧 */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              営業テンプレート
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              送信者情報と訴求内容を設定
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-medium hover:from-purple-700 hover:to-purple-600 transition-all shadow-md shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            新規作成
          </button>
        </div>

        {showCreate && <CreateTemplateForm onClose={() => { setShowCreate(false); window.location.reload(); }} />}

        <div className="p-6">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-zinc-300" />
              </div>
              <p className="text-sm text-zinc-400">
                テンプレートがまだありません
              </p>
              <p className="text-xs text-zinc-300 mt-1">
                「新規作成」から訴求内容を設定してください
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── テンプレートカード ─────────────────────────
function TemplateCard({ template: t }: { template: Template }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left flex items-center gap-4"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          t.isApproved
            ? "bg-emerald-50 border border-emerald-200"
            : "bg-amber-50 border border-amber-200"
        }`}>
          <FileText className={`w-5 h-5 ${t.isApproved ? "text-emerald-600" : "text-amber-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm text-zinc-900">{t.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              t.isApproved
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              {t.isApproved ? "承認済み" : "承認待ち"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400">{t.companyName} / {t.senderName}</span>
            <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
              {TARGET_TYPE_LABELS[t.targetType] ?? t.targetType}
            </span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-100">
          <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
            {t.serviceTypes?.map((s) => (
              <span key={s} className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-lg border border-purple-100 font-medium">
                {SERVICE_TYPE_OPTIONS.find((o) => o.id === s)?.icon}{" "}
                {SERVICE_TYPE_OPTIONS.find((o) => o.id === s)?.label ?? s}
              </span>
            ))}
          </div>
          <div className="bg-zinc-50 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-500 mb-2">訴求文</p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{t.pitchText}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── テンプレート作成フォーム ─────────────────────
function CreateTemplateForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTargetType, setSelectedTargetType] = useState<string>("BTOB");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [pitchTextValue, setPitchTextValue] = useState("");
  const [successExamples, setSuccessExamples] = useState<
    { id: string; branchName: string; targetType: string; serviceTypes: string[]; pitchText: string; responseCount: number }[]
  >([]);
  const [showExamples, setShowExamples] = useState(false);

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function loadSuccessExamples() {
    if (successExamples.length > 0) {
      setShowExamples(!showExamples);
      return;
    }
    try {
      const res = await fetch("/api/auto-sales/success-examples");
      if (res.ok) {
        const data = await res.json();
        setSuccessExamples(data);
      }
    } catch {}
    setShowExamples(true);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (selectedServices.length === 0) {
      setError("訴求カテゴリを1つ以上選択してください");
      setLoading(false);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const startDate = fd.get("scheduledStartDate") as string;
    const data = {
      name: fd.get("name"),
      companyName: fd.get("companyName"),
      senderName: fd.get("senderName"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      targetType: selectedTargetType,
      serviceTypes: selectedServices,
      pitchText: pitchTextValue || fd.get("pitchText"),
      scheduledStartDate: startDate || undefined,
    };

    try {
      const res = await fetch("/api/auto-sales/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "作成に失敗しました");
        return;
      }
      onClose();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="p-6 border-b border-zinc-100 bg-gradient-to-b from-purple-50/50 to-white space-y-5">
      {/* 設定名 */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          設定名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          placeholder="例: 徳島エリア美容室向け"
          className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
        />
      </div>

      {/* 送信者情報 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Building2 className="w-4 h-4 text-zinc-400" />
            送信元会社名 <span className="text-red-500">*</span>
          </label>
          <input
            name="companyName"
            required
            placeholder="例: ○○ AdArch"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <User className="w-4 h-4 text-zinc-400" />
            送信者名 <span className="text-red-500">*</span>
          </label>
          <input
            name="senderName"
            required
            placeholder="例: 宮本 貴史"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Phone className="w-4 h-4 text-zinc-400" />
            電話番号
          </label>
          <input
            name="phone"
            placeholder="例: 090-XXXX-XXXX"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
            <Mail className="w-4 h-4 text-zinc-400" />
            メールアドレス
          </label>
          <input
            name="email"
            type="email"
            placeholder="例: info@example.com"
            className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all placeholder:text-zinc-300"
          />
        </div>
      </div>

      {/* ターゲット種別 */}
      <div>
        <label className="block text-sm font-semibold text-zinc-700 mb-3">
          ターゲット種別 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(["BTOB", "BTOC"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedTargetType(type)}
              className={`py-3.5 rounded-xl text-sm font-bold border-2 transition-all ${
                selectedTargetType === type
                  ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm shadow-purple-500/10"
                  : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
              }`}
            >
              {TARGET_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* 訴求カテゴリ */}
      <div>
        <label className="block text-sm font-semibold text-zinc-700 mb-3">
          訴求カテゴリ（複数選択可） <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {SERVICE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggleService(opt.id)}
              className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl text-sm text-left border-2 transition-all ${
                selectedServices.includes(opt.id)
                  ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm shadow-purple-500/10"
                  : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 訴求文 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            訴求文 <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={loadSuccessExamples}
            className="text-xs text-purple-600 hover:text-purple-800 font-bold"
          >
            {showExamples ? "閉じる" : "成功実績を参考にする"}
          </button>
        </div>

        {showExamples && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 max-h-48 overflow-y-auto">
            {successExamples.length === 0 ? (
              <p className="text-xs text-emerald-600">まだ反響実績がありません。</p>
            ) : (
              successExamples.map((ex) => (
                <div key={ex.id} className="p-3 bg-white rounded-lg border border-emerald-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        反響 {ex.responseCount}件
                      </span>
                      <span className="text-xs text-zinc-400">{ex.branchName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setPitchTextValue(ex.pitchText); setShowExamples(false); }}
                      className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 font-medium"
                    >
                      この文を使う
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 whitespace-pre-wrap line-clamp-3 mt-1">{ex.pitchText}</p>
                </div>
              ))
            )}
          </div>
        )}

        <textarea
          name="pitchText"
          required
          rows={8}
          value={pitchTextValue}
          onChange={(e) => setPitchTextValue(e.target.value)}
          className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none placeholder:text-zinc-300"
          placeholder={`突然のご連絡失礼いたします。\n○○エリアで映像制作・広告プロモーションを手がけております○○と申します。\n\n貴社の○○に大変興味を持ち、ご連絡させていただきました。`}
        />
        <p className="text-xs text-zinc-400 mt-1.5">
          {"{industry}"} と書くと営業先の業種名に自動置換されます
        </p>
      </div>

      {/* 開始日 */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 mb-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          営業開始日
        </label>
        <input
          name="scheduledStartDate"
          type="date"
          className="w-full border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
        />
        <p className="text-xs text-zinc-400 mt-1.5">未指定の場合、承認後すぐに営業を開始します</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl text-sm font-bold hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2"
      >
        {loading ? (
          "作成中..."
        ) : (
          <>
            テンプレートを登録
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
