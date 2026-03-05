import Link from "next/link";
import { MapPin } from "lucide-react";
import { GENRE_OPTIONS } from "@/lib/constants/group-profile";

interface ProfileCardProps {
  id: string;
  name: string;
  ownerName: string;
  genre: string | null;
  prefecture: string | null;
  bio: string | null;
  specialty: string | null;
}

export function ProfileCard({ id, name, ownerName, genre, prefecture, bio, specialty }: ProfileCardProps) {
  const initials = ownerName.slice(0, 2);
  const genreStyle = GENRE_OPTIONS.find((g) => g.value === genre);

  return (
    <Link
      href={`/dashboard/group-profiles/${id}`}
      className="group block bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md hover:border-zinc-300 transition-all"
    >
      {/* アバター */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold ring-2 ring-blue-100 flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900 truncate group-hover:text-blue-600 transition-colors">
            {ownerName}
          </p>
          <p className="text-xs text-zinc-500 truncate">{name}</p>
        </div>
      </div>

      {/* ジャンル + 県 */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {genreStyle && (
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${genreStyle.color}`}>
            {genreStyle.label}
          </span>
        )}
        {prefecture && (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
            <MapPin className="w-3 h-3" />
            {prefecture}
          </span>
        )}
      </div>

      {/* 得意な仕事（あれば優先表示、なければ bio） */}
      {specialty ? (
        <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{specialty}</p>
      ) : bio ? (
        <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">{bio}</p>
      ) : (
        <p className="text-xs text-zinc-300 italic">自己紹介未設定</p>
      )}
    </Link>
  );
}
