import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Play } from "lucide-react";
import { VideoAnalyzer } from "./video-analyzer";

export default async function SnsFormatsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  // Get recent generated formats (reference formats from analyzed videos)
  const recentFormats = await prisma.snsReferenceFormat.findMany({
    where: isAdmin ? {} : { branchId: user.branchId! },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <Play className="h-6 w-6 text-fuchsia-500" />
          SNSフォーマット
        </h1>
        <p className="text-zinc-500 mt-1 text-sm">
          バズっている参考動画のURLを貼るだけで、構成・テロップ・撮影依頼書を自動生成。
          <br />
          生成したフォーマットをClaudeに渡すと、Adobe Premiere Proで自動編集されます。
        </p>
      </div>

      {/* Main Feature: Video Analyzer */}
      <VideoAnalyzer />

      {/* Recent generations */}
      {recentFormats.length > 0 && (
        <div data-tour="sns-format-recent" className="bg-white rounded-xl border mt-6">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-bold text-zinc-900">最近の生成</h2>
          </div>
          <div className="divide-y">
            {recentFormats.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 truncate">{f.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{f.industry}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">{f.duration}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {new Date(f.createdAt).toLocaleDateString("ja-JP")}
                    {f.sourceViews && ` ・ ${f.sourceViews.toLocaleString()}再生`}
                    {f.createdBy?.name && ` ・ ${f.createdBy.name}`}
                  </div>
                </div>
                <a
                  href={f.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-500 hover:text-indigo-600 shrink-0 ml-3"
                >
                  元動画 →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
