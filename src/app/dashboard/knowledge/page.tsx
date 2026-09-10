import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Brain } from "lucide-react";
import { KnowledgeLibrary } from "@/components/knowledge/library";

export const metadata = { title: "資料ライブラリ | Ad-Arch Group OS" };

export default async function KnowledgePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <Brain className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">資料ライブラリ</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            媒体資料・提案書・他社資料をOSの頭脳に。<span className="font-bold text-emerald-700">自社</span>はそのまま応用可、<span className="font-bold text-amber-700">他社・媒体</span>は仕組みだけ参考（価格は卸値・実績は他社分）
          </p>
        </div>
      </div>
      <KnowledgeLibrary />
    </div>
  );
}
