import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import {
  MapPin,
  Mail,
  Phone,
  Globe,
  Calendar,
  Wrench,
  ExternalLink,
  Youtube,
  Instagram,
  Twitter,
  Camera,
  Tag,
  DollarSign,
  Building2,
  Activity,
  RefreshCw,
  Image,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

/* ---------- helper types for JSON fields ---------- */
interface WorkItem {
  title?: string;
  category?: string;
  clientScale?: string;
  thumbnailUrl?: string;
  url?: string;
}

interface SnsFollowers {
  youtube?: number;
  instagram?: number;
  twitter?: number;
  tiktok?: number;
  facebook?: number;
  [key: string]: number | undefined;
}

/* ---------- small presentational helpers ---------- */

function ActivityScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70
      ? "text-emerald-500"
      : score >= 40
        ? "text-amber-500"
        : "text-red-400";
  const bgColor =
    score >= 70
      ? "stroke-emerald-100"
      : score >= 40
        ? "stroke-amber-100"
        : "stroke-red-100";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            className={bgColor}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={color}
            style={{
              stroke: "currentColor",
              strokeDasharray: circumference,
              strokeDashoffset: offset,
              transition: "stroke-dashoffset 0.6s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}</span>
          <span className="text-[10px] text-zinc-400">/ 100</span>
        </div>
      </div>
      <span className="mt-1 text-xs text-zinc-500 font-medium">
        アクティビティ
      </span>
    </div>
  );
}

function FreshnessIndicator({ date }: { date: Date }) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let color: string;
  let label: string;
  if (diffDays < 90) {
    color = "bg-emerald-500";
    label = "最近の活動";
  } else if (diffDays < 365) {
    color = "bg-amber-400";
    label = `${Math.floor(diffDays / 30)}ヶ月前`;
  } else {
    color = "bg-red-400";
    label = `${Math.floor(diffDays / 365)}年以上前`;
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
      <span className="text-sm text-zinc-700">
        {date.toLocaleDateString("ja-JP")}
      </span>
      <span className="text-xs text-zinc-400">({label})</span>
    </div>
  );
}

function formatFollowerCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

const SNS_CONFIG: Record<
  string,
  { label: string; icon: typeof Youtube; color: string; bgColor: string }
> = {
  youtube: {
    label: "YouTube",
    icon: Youtube,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  instagram: {
    label: "Instagram",
    icon: Instagram,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  twitter: {
    label: "X (Twitter)",
    icon: Twitter,
    color: "text-zinc-800",
    bgColor: "bg-zinc-100",
  },
  tiktok: {
    label: "TikTok",
    icon: Activity,
    color: "text-zinc-800",
    bgColor: "bg-zinc-100",
  },
  facebook: {
    label: "Facebook",
    icon: Globe,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
};

const GENRE_COLORS = [
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-sky-50 text-sky-700 border-sky-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
];

/* ================================================== */

export default async function CreatorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;

  const creator = await db.creator.findUnique({
    where: { id },
    include: {
      skills: { include: { category: true } },
      portfolios: { orderBy: { order: "asc" } },
      ndaAgreement: true,
      analysis: true,
      ratings: role === "ADMIN" ? { orderBy: { createdAt: "desc" } } : false,
    },
  });

  if (!creator) notFound();

  const LEVEL_LABEL: Record<string, string> = {
    BEGINNER: "初級",
    INTERMEDIATE: "中級",
    ADVANCED: "上級",
    EXPERT: "エキスパート",
  };

  const LEVEL_COLOR: Record<string, string> = {
    BEGINNER: "bg-zinc-100 text-zinc-600",
    INTERMEDIATE: "bg-blue-50 text-blue-700",
    ADVANCED: "bg-indigo-50 text-indigo-700",
    EXPERT: "bg-purple-50 text-purple-700",
  };

  const avgRating =
    creator.ratings && creator.ratings.length > 0
      ? (
          creator.ratings.reduce(
            (sum, r) =>
              sum +
              (r.personality +
                r.actualSkill +
                r.responseSpeed +
                r.deadlineCompliance) /
                4,
            0
          ) / creator.ratings.length
        ).toFixed(1)
      : null;

  /* --- analysis data --- */
  const analysis = creator.analysis;
  const hasAnalysis = analysis && analysis.scrapeStatus === "success";
  const works = (hasAnalysis ? (analysis.works as WorkItem[]) : null) ?? [];
  const snsFollowers = (
    hasAnalysis ? (analysis.snsFollowers as SnsFollowers) : null
  ) ?? {};
  const snsEntries = Object.entries(snsFollowers).filter(
    ([, v]) => v != null && v > 0
  ) as [string, number][];

  return (
    <div className="px-6 py-6 max-w-screen-lg mx-auto w-full">
      {/* 戻るリンク */}
      <Link
        href="/dashboard/creators"
        className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors mb-4 inline-block"
      >
        &larr; クリエイター一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {/* アバター */}
            <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
              {creator.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.profileImage} alt={creator.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-zinc-400 text-xl font-bold">{creator.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-zinc-900">
                  {creator.name}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                  {creator.entityType === "corporation" ? "法人" : "個人"}
                </span>
                {creator.hasBusinessRegistration && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    届出済み
                  </span>
                )}
              </div>
              {creator.companyName && (
                <p className="text-sm text-zinc-500">{creator.companyName}</p>
              )}
            </div>
          </div>
          {role === "ADMIN" && (
            <Link
              href={`/dashboard/creators/admin?id=${creator.id}`}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
            >
              裏評価・管理
            </Link>
          )}
        </div>

        {/* 基本情報グリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2 text-zinc-600">
            <MapPin style={{ width: "0.875rem", height: "0.875rem" }} />
            <span>
              {creator.prefecture}
              {creator.city ? ` ${creator.city}` : ""}
            </span>
          </div>
          {creator.email && (
            <div className="flex items-center gap-2 text-zinc-600">
              <Mail style={{ width: "0.875rem", height: "0.875rem" }} />
              <span>{creator.email}</span>
            </div>
          )}
          {creator.phone && (
            <div className="flex items-center gap-2 text-zinc-600">
              <Phone style={{ width: "0.875rem", height: "0.875rem" }} />
              <span>{creator.phone}</span>
            </div>
          )}
          {creator.website && (
            <a
              href={creator.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
            >
              <Globe style={{ width: "0.875rem", height: "0.875rem" }} />
              <span>Webサイト</span>
              <ExternalLink
                style={{ width: "0.625rem", height: "0.625rem" }}
              />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左カラム: スキル・単価・機材 */}
        <div className="lg:col-span-2 space-y-4">
          {/* スキル */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="font-bold text-sm text-zinc-900 mb-3">スキル</h2>
            <div className="space-y-2">
              {creator.skills.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0"
                >
                  <span className="text-sm text-zinc-700">
                    {s.category.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLOR[s.level]}`}
                    >
                      {LEVEL_LABEL[s.level]}
                    </span>
                    {s.note && (
                      <span className="text-xs text-zinc-400">{s.note}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 自己PR */}
          {creator.bio && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="font-bold text-sm text-zinc-900 mb-3">自己PR</h2>
              <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                {creator.bio}
              </p>
            </div>
          )}

          {/* ポートフォリオ */}
          {creator.portfolios.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="font-bold text-sm text-zinc-900 mb-3">
                ポートフォリオ
              </h2>
              <div className="space-y-2">
                {creator.portfolios.map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors"
                  >
                    <ExternalLink
                      className="text-zinc-400 shrink-0"
                      style={{ width: "0.875rem", height: "0.875rem" }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-700 truncate">
                        {p.title || p.url}
                      </p>
                      {p.title && (
                        <p className="text-xs text-zinc-400 truncate">
                          {p.url}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ===== Webサイト分析（大幅強化） ===== */}
          {hasAnalysis && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-6">
              {/* Section Header */}
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                  <Globe
                    style={{ width: "0.875rem", height: "0.875rem" }}
                    className="text-indigo-500"
                  />
                  Webサイト分析
                </h2>
                {role === "ADMIN" && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
                  >
                    <RefreshCw
                      style={{ width: "0.75rem", height: "0.75rem" }}
                    />
                    Webサイトを再分析
                  </button>
                )}
              </div>

              {/* Row 1: Activity Score + Estimated Rate + Client Scale */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Activity Score */}
                {analysis.activityScore != null && (
                  <div className="flex justify-center py-2">
                    <ActivityScoreRing score={analysis.activityScore} />
                  </div>
                )}

                {/* Estimated Rate */}
                {analysis.estimatedRate != null && (
                  <div className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <DollarSign
                        style={{ width: "0.875rem", height: "0.875rem" }}
                        className="text-emerald-500"
                      />
                      <span className="text-xs text-zinc-500 font-medium">
                        AI推定日額単価
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-900">
                      &yen;{analysis.estimatedRate.toLocaleString()}
                    </p>
                    {analysis.priceRange && (
                      <span className="mt-1.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        {analysis.priceRange}
                      </span>
                    )}
                  </div>
                )}

                {/* Client Scale */}
                {analysis.clientScale && (
                  <div className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <Building2
                        style={{ width: "0.875rem", height: "0.875rem" }}
                        className="text-blue-500"
                      />
                      <span className="text-xs text-zinc-500 font-medium">
                        クライアント規模
                      </span>
                    </div>
                    <span className="mt-1 text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                      {analysis.clientScale}
                    </span>
                  </div>
                )}
              </div>

              {/* Row 2: Genres */}
              {analysis.genres.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag
                      style={{ width: "0.75rem", height: "0.75rem" }}
                      className="text-violet-500"
                    />
                    <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide">
                      制作ジャンル
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.genres.map((g, i) => (
                      <span
                        key={g}
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${GENRE_COLORS[i % GENRE_COLORS.length]}`}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 3: Equipment */}
              {analysis.equipmentList.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Camera
                      style={{ width: "0.75rem", height: "0.75rem" }}
                      className="text-zinc-500"
                    />
                    <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide">
                      検出機材
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.equipmentList.map((eq) => (
                      <div
                        key={eq}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700"
                      >
                        <Wrench
                          style={{ width: "0.625rem", height: "0.625rem" }}
                          className="text-zinc-400"
                        />
                        {eq}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 4: SNS Followers */}
              {snsEntries.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide mb-2">
                    SNSフォロワー
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {snsEntries.map(([platform, count]) => {
                      const cfg = SNS_CONFIG[platform] ?? {
                        label: platform,
                        icon: Globe,
                        color: "text-zinc-600",
                        bgColor: "bg-zinc-50",
                      };
                      const Icon = cfg.icon;
                      return (
                        <div
                          key={platform}
                          className={`flex items-center gap-3 p-3 rounded-xl ${cfg.bgColor} border border-zinc-100`}
                        >
                          <Icon
                            className={`${cfg.color} shrink-0`}
                            style={{ width: "1.25rem", height: "1.25rem" }}
                          />
                          <div>
                            <p className="text-[10px] text-zinc-400 leading-none">
                              {cfg.label}
                            </p>
                            <p className="text-sm font-bold text-zinc-900">
                              {formatFollowerCount(count)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Row 5: Last Work Date */}
              {analysis.lastWorkDate && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock
                      style={{ width: "0.75rem", height: "0.75rem" }}
                      className="text-zinc-500"
                    />
                    <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide">
                      最終更新日
                    </h3>
                  </div>
                  <FreshnessIndicator
                    date={new Date(analysis.lastWorkDate)}
                  />
                </div>
              )}

              {/* Row 6: Works Grid */}
              {works.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Image
                      style={{ width: "0.75rem", height: "0.75rem" }}
                      className="text-zinc-500"
                    />
                    <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide">
                      制作実績（{works.length}件）
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {works.map((w, i) => (
                      <div
                        key={`${w.title ?? ""}-${i}`}
                        className="group rounded-xl border border-zinc-200 overflow-hidden hover:border-zinc-300 hover:shadow-sm transition-all"
                      >
                        {/* Thumbnail or placeholder */}
                        {w.thumbnailUrl ? (
                          <div className="relative h-32 bg-zinc-100 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={w.thumbnailUrl}
                              alt={w.title ?? ""}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <div className="h-24 bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center">
                            <Image
                              style={{ width: "1.5rem", height: "1.5rem" }}
                              className="text-zinc-300"
                            />
                          </div>
                        )}
                        <div className="p-3">
                          <p className="text-sm font-medium text-zinc-800 truncate">
                            {w.title ?? "無題"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {w.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                                {w.category}
                              </span>
                            )}
                            {w.clientScale && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                                {w.clientScale}
                              </span>
                            )}
                          </div>
                          {w.url && (
                            <a
                              href={w.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-500 hover:text-indigo-700"
                            >
                              <ExternalLink
                                style={{
                                  width: "0.625rem",
                                  height: "0.625rem",
                                }}
                              />
                              詳細を見る
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右カラム: サマリー */}
        <div className="space-y-4">
          {/* 単価・稼働 */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="font-bold text-sm text-zinc-900 mb-3">
              単価・稼働
            </h2>
            <div className="space-y-3 text-sm">
              {creator.dayRate && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">日額単価</span>
                  <span className="font-bold text-zinc-900">
                    &yen;{creator.dayRate.toLocaleString()}
                  </span>
                </div>
              )}
              {creator.halfDayRate && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">半日単価</span>
                  <span className="font-bold text-zinc-900">
                    &yen;{creator.halfDayRate.toLocaleString()}
                  </span>
                </div>
              )}
              {creator.yearsOfExp && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">経験年数</span>
                  <span className="text-zinc-700">{creator.yearsOfExp}年</span>
                </div>
              )}
              {creator.availability && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">月間稼働可能</span>
                  <span className="text-zinc-700">
                    {creator.availability}日
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 機材 */}
          {creator.equipment && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="font-bold text-sm text-zinc-900 mb-3 flex items-center gap-1.5">
                <Wrench style={{ width: "0.875rem", height: "0.875rem" }} />
                所有機材
              </h2>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">
                {creator.equipment}
              </p>
            </div>
          )}

          {/* NDA */}
          {creator.ndaAgreement && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <h2 className="font-bold text-sm text-emerald-800 mb-1">
                NDA締結済み
              </h2>
              <p className="text-xs text-emerald-600">
                {new Date(creator.ndaAgreement.agreedAt).toLocaleDateString(
                  "ja-JP"
                )}{" "}
                締結（v{creator.ndaAgreement.ndaVersion}）
              </p>
            </div>
          )}

          {/* ADMIN: 裏評価サマリー */}
          {role === "ADMIN" && creator.ratings && creator.ratings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="font-bold text-sm text-amber-800 mb-2">
                裏評価（ADMIN）
              </h2>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-amber-700">総合評価</span>
                  <span className="font-bold text-amber-900">
                    {avgRating} / 10.0
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">評価回数</span>
                  <span className="text-amber-900">
                    {creator.ratings.length}回
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700">TV会議面接</span>
                  <span className="text-amber-900">
                    {creator.ratings.some((r) => r.videoInterviewed)
                      ? "実施済み"
                      : "未実施"}
                  </span>
                </div>
              </div>
              <Link
                href={`/dashboard/creators/admin?id=${creator.id}`}
                className="block mt-3 text-center text-xs text-amber-700 hover:text-amber-900 font-medium"
              >
                詳細を見る &rarr;
              </Link>
            </div>
          )}

          {/* 登録日 */}
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Calendar style={{ width: "0.75rem", height: "0.75rem" }} />
            登録日:{" "}
            {new Date(creator.createdAt).toLocaleDateString("ja-JP")}
          </div>
        </div>
      </div>
    </div>
  );
}
