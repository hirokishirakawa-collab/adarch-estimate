import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Plug } from "lucide-react";
import { McpConnect } from "../brand-kit/McpConnect";

/** 「AIと直接つなぐ（MCP）」専用ページ — 中身はブランドキットの同部品を再利用 */
export default async function AiConnectPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const email = session.user.email ?? "";

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <Plug className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">AIと直接つなぐ（MCP）</h2>
          <p className="text-xs text-zinc-500 mt-0.5">いつもの Claude／ChatGPT が、OSの材料と貴社の数字を自分で読み書きします。つなぐのは一度だけ・5分。</p>
        </div>
      </div>
      <McpConnect email={email} />
    </div>
  );
}
