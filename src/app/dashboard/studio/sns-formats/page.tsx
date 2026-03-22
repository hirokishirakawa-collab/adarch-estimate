import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Play } from "lucide-react";
import { VideoAnalyzer } from "./video-analyzer";
import { FormatGallery } from "./format-gallery";

export default async function SnsFormatsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  const formats = await prisma.snsReferenceFormat.findMany({
    where: isAdmin ? {} : { branchId: user.branchId! },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <Play className="h-6 w-6 text-fuchsia-500" />
          SNSフォーマット
        </h1>
        <p className="text-zinc-500 mt-1 text-sm">
          バズっている参考動画のURLを貼るだけで、構成・テロップ・撮影依頼書を自動生成。
          生成したフォーマットをClaudeに渡すと、Adobe Premiere Proで自動編集されます。
        </p>
      </div>

      {/* Main: Video Analyzer */}
      <VideoAnalyzer />

      {/* Format Gallery */}
      <FormatGallery initialFormats={JSON.parse(JSON.stringify(formats))} />
    </div>
  );
}
