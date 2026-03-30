"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  SkipForward,
  Eye,
  Plus,
  Send,
  Filter,
  ExternalLink,
} from "lucide-react";

// ステータスの表示設定
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  QUEUED: {
    label: "待機中",
    icon: Clock,
    color: "text-zinc-500",
    bgColor: "bg-zinc-50",
  },
  PROCESSING: {
    label: "実行中",
    icon: Loader2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  COMPLETED: {
    label: "送信完了",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  FAILED: {
    label: "失敗",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  SKIPPED: {
    label: "スキップ",
    icon: SkipForward,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  DRY_RUN: {
    label: "ドライラン",
    icon: Eye,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
};

interface Job {
  id: string;
  status: string;
  screenshotUrl: string | null;
  filledData: Record<string, string> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  target: {
    companyName: string;
    url: string;
    area: string | null;
    industry: string | null;
    branch?: { name: string };
  };
  template: {
    name: string;
    companyName: string;
  };
}

interface Template {
  id: string;
  name: string;
  companyName: string;
  senderName: string;
  targetType: string;
  serviceTypes: string[];
  pitchText: string;
  body: string;
  isApproved: boolean;
  branch: { name: string } | null;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  BTOB: "BtoB（法人向け）",
  BTOC: "BtoC（個人・店舗向け）",
};

const SERVICE_TYPE_OPTIONS = [
  { id: "VIDEO_PRODUCTION", label: "動画制作" },
  { id: "SNS_MANAGEMENT", label: "SNS運用" },
  { id: "AD_MEDIA", label: "広告媒体提案" },
  { id: "FIRST_MEETING", label: "初回商談（とりあ���ず会いたい）" },
] as const;

export function AutoSalesMonitor({
  initialJobs,
  templates,
  isAdmin,
  branchName,
}: {
  initialJobs: Job[];
  templates: Template[];
  isAdmin: boolean;
  branchName: string;
}) {
  const [jobs] = useState<Job[]>(initialJobs);
  const [filter, setFilter] = useState<string>("ALL");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const filteredJobs =
    filter === "ALL" ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div className="space-y-6">
      {/* アクションバー */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowAddTarget(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          営業先を追加
        </button>
        <button
          onClick={() => setShowAddTemplate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-900 transition-colors"
        >
          <Send className="w-4 h-4" />
          テンプレート管理
        </button>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-zinc-400" />
        {["ALL", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "SKIPPED", "DRY_RUN"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {s === "ALL" ? "すべて" : STATUS_CONFIG[s]?.label ?? s}
              {s !== "ALL" && (
                <span className="ml-1 opacity-60">
                  ({jobs.filter((j) => j.status === s).length})
                </span>
              )}
            </button>
          )
        )}
      </div>

      {/* ジョブリスト */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-zinc-400 text-sm">
              {jobs.length === 0
                ? "まだ営業ジョブがありません。営業先を追加してキューに投入してください。"
                : "該当するジョブがありません"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredJobs.map((job) => {
              const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.QUEUED;
              const Icon = config.icon;
              const time = job.completedAt ?? job.startedAt ?? job.createdAt;

              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}
                  >
                    <Icon
                      className={`w-4 h-4 ${config.color} ${
                        job.status === "PROCESSING" ? "animate-spin" : ""
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-zinc-900 truncate">
                        {job.target.companyName}
                      </span>
                      {job.target.area && (
                        <span className="text-xs text-zinc-400">
                          {job.target.area}
                        </span>
                      )}
                      {job.target.industry && (
                        <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                          {job.target.industry}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {job.template.companyName} → {job.target.url}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-medium ${config.color}`}
                    >
                      {config.label}
                    </span>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(time).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 営業先追加モーダル */}
      {showAddTarget && (
        <AddTargetModal onClose={() => setShowAddTarget(false)} />
      )}

      {/* テンプレート管理モーダル */}
      {showAddTemplate && (
        <TemplateModal
          templates={templates}
          isAdmin={isAdmin}
          onClose={() => setShowAddTemplate(false)}
        />
      )}

      {/* ジョブ詳細モーダル */}
      {selectedJob && (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}

// ─── 営業先追加モーダル ─────────────────────
function AddTargetModal({ onClose }: { onClose: () => void }) {
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
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1000);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">営業先を追加</h2>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-zinc-600">登録しました</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="企業名" name="companyName" required placeholder="例: ○○工務店" />
            <Field
              label="問い合わせフォームURL"
              name="url"
              required
              type="url"
              placeholder="https://example.com/contact"
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="業種" name="industry" placeholder="例: 美容室" />
              <Field label="エリア" name="area" placeholder="例: 徳島" />
            </div>
            <Field label="電話番号" name="phone" placeholder="例: 088-XXX-XXXX" />
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                メモ
              </label>
              <textarea
                name="note"
                rows={2}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "登録中..." : "登録"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── 営業設定モーダル ─────────────────────────
function TemplateModal({
  templates,
  isAdmin,
  onClose,
}: {
  templates: Template[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTargetType, setSelectedTargetType] = useState<string>("BTOB");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [successExamples, setSuccessExamples] = useState<
    { id: string; branchName: string; targetType: string; serviceTypes: string[]; pitchText: string; responseCount: number }[]
  >([]);
  const [showExamples, setShowExamples] = useState(false);
  const [pitchTextValue, setPitchTextValue] = useState("");

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

    const fd = new FormData(e.currentTarget);

    if (selectedServices.length === 0) {
      setError("訴求カテゴリを1つ以上選択してください");
      setLoading(false);
      return;
    }

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
      window.location.reload();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-900">営業設定</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
          >
            <Plus className="w-3 h-3" />
            新規作成
          </button>
        </div>

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="space-y-4 mb-6 p-4 bg-zinc-50 rounded-xl border border-zinc-200"
          >
            <Field label="設定名" name="name" required placeholder="例: 徳島エリア美容室向け" />

            {/* 送信者情報 */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="送信元会社名" name="companyName" required placeholder="例: ○○ AdArch" />
              <Field label="送信者名（代表名）" name="senderName" required placeholder="例: 宮本 貴史" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="電話番号" name="phone" placeholder="例: 090-XXXX-XXXX" />
              <Field label="メールアドレス" name="email" type="email" placeholder="例: info@example.com" />
            </div>

            {/* BtoB / BtoC 選択 */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                ターゲット種別 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {(["BTOB", "BTOC"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedTargetType(type)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                      selectedTargetType === type
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {TARGET_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* 訴求カテゴリ（複数選択） */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                訴求カテゴリ（複数選択可） <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleService(opt.id)}
                    className={`px-3 py-2.5 rounded-lg text-sm text-left border-2 transition-colors ${
                      selectedServices.includes(opt.id)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    <span className="mr-1.5">
                      {selectedServices.includes(opt.id) ? "✓" : "○"}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 訴求文（自由記述） */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-zinc-700">
                  訴求文（あなたの言葉で書いてください） <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={loadSuccessExamples}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showExamples ? "閉じる" : "成功実績を参考にする"}
                </button>
              </div>

              {/* 成功実績パネル */}
              {showExamples && (
                <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 max-h-48 overflow-y-auto">
                  {successExamples.length === 0 ? (
                    <p className="text-xs text-emerald-600">まだ反響実績がありません。営業が始まると、反響のあった訴求文がここに表示されます。</p>
                  ) : (
                    successExamples.map((ex) => (
                      <div key={ex.id} className="p-2 bg-white rounded-lg border border-emerald-100">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                              反響 {ex.responseCount}件
                            </span>
                            <span className="text-xs text-zinc-400">{ex.branchName}</span>
                            <span className="text-xs text-zinc-400">
                              {TARGET_TYPE_LABELS[ex.targetType]}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPitchTextValue(ex.pitchText);
                              setShowExamples(false);
                            }}
                            className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700"
                          >
                            この文を使う
                          </button>
                        </div>
                        <p className="text-xs text-zinc-600 whitespace-pre-wrap line-clamp-3">{ex.pitchText}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              <textarea
                name="pitchText"
                required
                rows={6}
                value={pitchTextValue}
                onChange={(e) => setPitchTextValue(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder={`突然のご連絡失礼いたします。\n○○エリアで映像制作・広告プロモーションを手がけております○○と申します。\n\n貴社の○○に大変興味を持ち、ご連絡させていただきました。\n当社では地域密着型の映像制作を得意としており、\nSNS向けショート動画から企業VP まで幅広く対応しております。`}
              />
              <p className="text-xs text-zinc-400 mt-1">
                この訴求文がフォーム送信時の本文のベースになります。
                {"{industry}"}と書くと営業先の業種名に自動置換されます。
              </p>
            </div>

            {/* 開始日 */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                営業開始日
              </label>
              <input
                name="scheduledStartDate"
                type="date"
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-zinc-400 mt-1">
                未指定の場合、承認後すぐに営業を開始します
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "作成中..." : "営業設定を登録"}
            </button>
          </form>
        )}

        {/* 営業設定一覧 */}
        <div className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">
              営業設定がまだありません。「新規作成」から訴求内容を設定してください。
            </p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="p-4 border border-zinc-200 rounded-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.name}</span>
                    <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                      {TARGET_TYPE_LABELS[t.targetType] ?? t.targetType}
                    </span>
                    {t.branch && (
                      <span className="text-xs text-zinc-400">
                        {t.branch.name}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      t.isApproved
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {t.isApproved ? "承認済み" : "承認待ち"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {t.serviceTypes?.map((s) => (
                    <span
                      key={s}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full"
                    >
                      {SERVICE_TYPE_OPTIONS.find((o) => o.id === s)?.label ?? s}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  {t.companyName} / {t.senderName}
                </p>
                <p className="text-xs text-zinc-400 mt-2 whitespace-pre-wrap line-clamp-3">
                  {t.pitchText}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ジョブ詳細モーダル ──────────────────────
function JobDetailModal({
  job,
  onClose,
}: {
  job: Job;
  onClose: () => void;
}) {
  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.QUEUED;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor}`}
          >
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {job.target.companyName}
            </h2>
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <DetailRow label="URL">
            <a
              href={job.target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm flex items-center gap-1"
            >
              {job.target.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </DetailRow>
          {job.target.area && <DetailRow label="エリア">{job.target.area}</DetailRow>}
          {job.target.industry && <DetailRow label="業種">{job.target.industry}</DetailRow>}
          <DetailRow label="テンプレート">
            {job.template.name}（{job.template.companyName}）
          </DetailRow>
          <DetailRow label="作成日時">
            {new Date(job.createdAt).toLocaleString("ja-JP")}
          </DetailRow>
          {job.startedAt && (
            <DetailRow label="開始日時">
              {new Date(job.startedAt).toLocaleString("ja-JP")}
            </DetailRow>
          )}
          {job.completedAt && (
            <DetailRow label="完了日時">
              {new Date(job.completedAt).toLocaleString("ja-JP")}
            </DetailRow>
          )}

          {/* 入力データ */}
          {job.filledData && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">
                入力データ
              </p>
              <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
                {Object.entries(job.filledData).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-zinc-400 min-w-[80px]">{key}:</span>
                    <span className="text-zinc-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* スクリーンショット */}
          {job.screenshotUrl && (
            <div className="mt-4">
              <p className="text-xs font-medium text-zinc-500 mb-2">
                送信前スクリーンショット
              </p>
              <img
                src={job.screenshotUrl}
                alt="Screenshot"
                className="w-full rounded-lg border border-zinc-200"
              />
            </div>
          )}

          {/* エラーメッセージ */}
          {job.errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-medium text-red-700 mb-1">
                エラー
              </p>
              <p className="text-xs text-red-600">{job.errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 共通パーツ ─────────────────────────────
function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-zinc-400 min-w-[80px] pt-0.5">{label}</span>
      <div className="text-sm text-zinc-700">{children}</div>
    </div>
  );
}
