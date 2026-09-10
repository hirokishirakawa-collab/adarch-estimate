import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Brain, ChevronLeft } from "lucide-react";
import { KnowledgeAdmin } from "@/components/knowledge/admin";

export const metadata = { title: "資料ライブラリ（本部）| Ad-Arch Group OS" };

interface PageProps {
  searchParams: Promise<{ focus?: string }>;
}

export default async function KnowledgeAdminPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // 本部専用（二重の保険: proxy の /dashboard/admin ガード＋ここ。API側でも ADMIN 判定）
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const { focus } = await searchParams;

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <Brain className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">資料ライブラリ（本部）</h2>
            <p className="text-xs text-zinc-500 mt-0.5">登録・出どころの切り分け・本部限定・やり直し。登録した資料は全員の「資料に聞く」・アーチくん・AI連携（MCP）から引けます</p>
          </div>
        </div>
        <Link href="/dashboard/knowledge" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
          <ChevronLeft className="w-3.5 h-3.5" /> 全員の画面を見る
        </Link>
      </div>
      <KnowledgeAdmin focusId={focus} />
    </div>
  );
}
