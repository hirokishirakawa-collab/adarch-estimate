import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SkylarkSimulator } from "@/components/skylark/SkylarkSimulator";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

export const metadata = { title: "すかいらーくインストア広告シミュレーター" };

export default async function SkylarkSimulatorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">🍽️</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">すかいらーくインストア広告シミュレーター</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            エリア・ブランド・商品タイプから媒体費・製作費・Ad-Arch提示価格を概算します
          </p>
          <WikiHelpLink query="すかいらーく" />
        </div>
      </div>
      <SkylarkSimulator />
    </div>
  );
}
