import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sparkles } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { getCreatorLeads } from "@/lib/actions/creator-lead";
import { CreatorLeadsBoard } from "./creator-leads-board";

export default async function CreatorLeadsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const leads = await getCreatorLeads();
  const rows = leads.map((l) => ({
    id: l.id,
    name: l.name,
    handle: l.handle,
    prefecture: l.prefecture,
    genre: l.genre,
    skills: l.skills,
    portfolioUrl: l.portfolioUrl,
    youtubeUrl: l.youtubeUrl,
    instagramUrl: l.instagramUrl,
    xUrl: l.xUrl,
    tiktokUrl: l.tiktokUrl,
    email: l.email,
    scoreTotal: l.scoreTotal,
    scoreComment: l.scoreComment,
    fitReason: l.fitReason,
    aiAdvice: l.aiAdvice,
    status: l.status,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-fuchsia-50 rounded-xl flex items-center justify-center">
          <Sparkles className="text-fuchsia-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">クリエイター発掘AI</h2>
          <p className="text-xs text-zinc-500 mt-0.5">クリエイター加盟プラン候補をWeb検索で発掘・スコアリング（本部・代表専用）</p>
        </div>
      </div>
      <CreatorLeadsBoard initialRows={rows} />
    </div>
  );
}
