import Link from "next/link";
import {
  MapPin,
  Globe,
  ArrowLeft,
  Pencil,
  MessageCircle,
} from "lucide-react";
import { SNS_PLATFORMS, GENRE_OPTIONS } from "@/lib/constants/group-profile";

interface ProfileData {
  id: string;
  name: string;
  ownerName: string;
  chatSpaceId: string;
  genre: string | null;
  specialty: string | null;
  workHistory: string | null;
  prefecture: string | null;
  bio: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  lineId: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
}

interface ProfileDetailProps {
  profile: ProfileData;
  canEdit: boolean;
  editHref: string;
  isOwner: boolean;
}

/** SNS アイコン（SVG インライン） */
function SnsIcon({ icon }: { icon: string }) {
  const cls = "w-4 h-4";
  switch (icon) {
    case "twitter":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );
    case "line":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
      );
    case "globe":
    default:
      return <Globe className={cls} />;
  }
}

export function ProfileDetail({ profile, canEdit, editHref, isOwner }: ProfileDetailProps) {
  const initials = profile.ownerName.slice(0, 2);
  const genreStyle = GENRE_OPTIONS.find((g) => g.value === profile.genre);

  // Google Chat スペースへの DM リンク
  const chatUrl = `https://chat.google.com/room/${profile.chatSpaceId}`;

  // SNS リンク一覧を構築
  const snsLinks = SNS_PLATFORMS
    .map((p) => {
      const value = profile[p.key as keyof ProfileData] as string | null;
      return value ? { ...p, value } : null;
    })
    .filter(Boolean) as { key: string; label: string; icon: string; value: string }[];

  return (
    <div className="max-w-2xl mx-auto">
      {/* 戻る + 編集 */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/group-profiles"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          一覧に戻る
        </Link>
        {canEdit && (
          <Link
            href={editHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 text-white rounded-md hover:bg-zinc-700 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            編集
          </Link>
        )}
      </div>

      {/* カード */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        {/* ヘッダー */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold ring-2 ring-blue-100 flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-zinc-900">{profile.ownerName}</h2>
            <p className="text-sm text-zinc-500">{profile.name}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {genreStyle && (
                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${genreStyle.color}`}>
                  {genreStyle.label}
                </span>
              )}
              {profile.prefecture && (
                <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                  <MapPin className="w-3 h-3" />
                  {profile.prefecture}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* この代表に相談するボタン（自分以外に表示） */}
        {!isOwner && (
          <a
            href={chatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 mb-5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            この代表に相談する
          </a>
        )}

        {/* 自己紹介 */}
        {profile.bio && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">自己紹介</h3>
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {/* 得意な仕事 */}
        {profile.specialty && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">得意な仕事</h3>
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{profile.specialty}</p>
          </div>
        )}

        {/* これまでの仕事 */}
        {profile.workHistory && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">これまでの仕事</h3>
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{profile.workHistory}</p>
          </div>
        )}

        {/* SNS リンク */}
        {snsLinks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">SNS / リンク</h3>
            <div className="flex flex-wrap gap-2">
              {snsLinks.map((sns) => {
                const isUrl = sns.value.startsWith("http");
                return isUrl ? (
                  <a
                    key={sns.key}
                    href={sns.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
                  >
                    <SnsIcon icon={sns.icon} />
                    {sns.label}
                  </a>
                ) : (
                  <span
                    key={sns.key}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-full text-zinc-600"
                  >
                    <SnsIcon icon={sns.icon} />
                    {sns.label}: {sns.value}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 何も設定されていない場合 */}
        {!profile.bio && !profile.specialty && !profile.workHistory && snsLinks.length === 0 && !profile.prefecture && (
          <p className="text-sm text-zinc-400 italic">プロフィール情報がまだ設定されていません</p>
        )}
      </div>
    </div>
  );
}
