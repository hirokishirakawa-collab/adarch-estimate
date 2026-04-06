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
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

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
              (r.personality + r.actualSkill + r.responseSpeed + r.deadlineCompliance) / 4,
            0
          ) / creator.ratings.length
        ).toFixed(1)
      : null;

  return (
    <div className="px-6 py-6 max-w-screen-lg mx-auto w-full">
      {/* 戻るリンク */}
      <Link
        href="/dashboard/creators"
        className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors mb-4 inline-block"
      >
        ← クリエイター一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
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
              <ExternalLink style={{ width: "0.625rem", height: "0.625rem" }} />
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

          {/* AI分析結果 */}
          {creator.analysis &&
            creator.analysis.scrapeStatus === "success" && (
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h2 className="font-bold text-sm text-zinc-900 mb-3">
                  AI分析結果
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {creator.analysis.genres.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">制作ジャンル</p>
                      <div className="flex flex-wrap gap-1">
                        {creator.analysis.genres.map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {creator.analysis.estimatedRate && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">
                        AI推定日額単価
                      </p>
                      <p className="font-bold text-zinc-900">
                        ¥{creator.analysis.estimatedRate.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {creator.analysis.clientScale && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">
                        クライアント規模感
                      </p>
                      <p className="text-zinc-700">
                        {creator.analysis.clientScale}
                      </p>
                    </div>
                  )}
                  {creator.analysis.equipmentList.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">検出機材</p>
                      <p className="text-zinc-700">
                        {creator.analysis.equipmentList.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
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
                    ¥{creator.dayRate.toLocaleString()}
                  </span>
                </div>
              )}
              {creator.halfDayRate && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">半日単価</span>
                  <span className="font-bold text-zinc-900">
                    ¥{creator.halfDayRate.toLocaleString()}
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
                詳細を見る →
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
