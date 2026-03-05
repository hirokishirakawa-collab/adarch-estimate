import { Users2 } from "lucide-react";
import { getProfiles, getMyGroupCompany } from "@/lib/actions/group-profile";
import { getActiveHighlights } from "@/lib/actions/collaboration-highlight";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { ProfileCard } from "@/components/group-profiles/profile-card";
import { GenreFilter } from "@/components/group-profiles/genre-filter";
import { CollaborationBanner } from "@/components/group-profiles/collaboration-banner";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ genre?: string }>;
}

export default async function GroupProfilesPage({ searchParams }: Props) {
  const params = await searchParams;
  const genreFilter = params.genre || null;

  const [profiles, myCompany, session, highlights] = await Promise.all([
    getProfiles(),
    getMyGroupCompany(),
    auth(),
    getActiveHighlights(),
  ]);

  const role = (session?.user?.role ?? "USER") as UserRole;

  const filtered = genreFilter
    ? profiles.filter((p) => p.genre === genreFilter)
    : profiles;

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <Users2 className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">メンバー紹介</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              グループ各社の代表者プロフィール
            </p>
          </div>
        </div>
        {myCompany && (
          <Link
            href="/dashboard/group-profiles/edit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-white rounded-md hover:bg-zinc-700 transition-colors"
          >
            自分のプロフィールを編集
          </Link>
        )}
      </div>

      {/* 紐付けなし案内 */}
      {!myCompany && role !== "ADMIN" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-xs text-amber-700">
          あなたのアカウントにグループ企業が紐付けされていません。管理者にお問い合わせください。
        </div>
      )}

      {/* 連携案件ハイライト */}
      <CollaborationBanner highlights={highlights} />

      {/* ADMIN: ハイライト管理リンク */}
      {role === "ADMIN" && (
        <div className="mb-4">
          <Link
            href="/dashboard/group-profiles/highlights"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100 transition-colors"
          >
            連携案件を管理
          </Link>
        </div>
      )}

      {/* ジャンルフィルタ */}
      <GenreFilter current={genreFilter} />

      {/* カード一覧 */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProfileCard
              key={p.id}
              id={p.id}
              name={p.name}
              ownerName={p.ownerName}
              emoji={p.emoji}
              genre={p.genre}
              prefecture={p.prefecture}
              bio={p.bio}
              specialty={p.specialty}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-sm text-zinc-400">
          {genreFilter ? `「${genreFilter}」のメンバーはいません` : "メンバー情報がありません"}
        </div>
      )}
    </div>
  );
}
