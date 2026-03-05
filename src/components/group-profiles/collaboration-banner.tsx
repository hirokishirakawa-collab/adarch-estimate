import Link from "next/link";
import { Sparkles } from "lucide-react";

interface HighlightMember {
  groupCompany: {
    id: string;
    name: string;
    ownerName: string;
    emoji: string | null;
  };
}

interface Highlight {
  id: string;
  title: string;
  description: string;
  emoji: string | null;
  members: HighlightMember[];
}

interface CollaborationBannerProps {
  highlights: Highlight[];
}

export function CollaborationBanner({ highlights }: CollaborationBannerProps) {
  if (highlights.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-bold text-zinc-900">連携案件ハイライト</h3>
      </div>
      <div className="space-y-3">
        {highlights.map((h) => (
          <div
            key={h.id}
            className="relative overflow-hidden rounded-xl border border-violet-200/60 bg-gradient-to-r from-violet-50 via-blue-50 to-purple-50 p-4 shadow-sm"
          >
            {/* 装飾 */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-200/20 to-transparent rounded-bl-full pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                {h.emoji && <span className="text-lg">{h.emoji}</span>}
                <span className="text-sm font-bold text-violet-900">{h.title}</span>
              </div>
              <p className="text-xs text-violet-700/80 mb-2.5 leading-relaxed">
                {h.description}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {h.members.map((m) => (
                  <Link
                    key={m.groupCompany.id}
                    href={`/dashboard/group-profiles/${m.groupCompany.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-white/80 text-violet-700 rounded-full border border-violet-200/60 hover:bg-white hover:border-violet-300 transition-colors shadow-sm"
                  >
                    {m.groupCompany.emoji && (
                      <span className="text-xs">{m.groupCompany.emoji}</span>
                    )}
                    {m.groupCompany.ownerName}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
