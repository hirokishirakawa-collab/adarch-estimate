import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { StrategyAdvisor } from "@/components/strategy-advisor/StrategyAdvisor";

export const metadata = { title: "提案戦略アドバイザー（AI）" };

export default async function StrategyAdvisorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <Sparkles className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            提案戦略アドバイザー（AI）
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            ターゲット・目的・予算を入力すると、AIが最適な媒体プランを提案します
          </p>
        </div>
      </div>

      <StrategyAdvisor />
    </div>
  );
}
