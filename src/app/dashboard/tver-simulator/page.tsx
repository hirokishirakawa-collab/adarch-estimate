import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TVerSimulator } from "@/components/tver/TVerSimulator";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

export const metadata = { title: "TVer広告シミュレーター" };

export default async function TVerSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ budget?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const initialBudget = params.budget ? parseInt(params.budget, 10) : undefined;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">📺</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">TVer広告シミュレーター</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            エリア・秒数・予算から配信コストとリーチを概算します
          </p>
          <WikiHelpLink query="TVerシミュレーター" />
        </div>
      </div>
      <TVerSimulator initialBudget={initialBudget} />
    </div>
  );
}
