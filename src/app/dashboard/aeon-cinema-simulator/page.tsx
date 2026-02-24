import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AeonCinemaSimulator } from "@/components/aeon-cinema/AeonCinemaSimulator";

export const metadata = { title: "イオンシネマ広告シミュレーター" };

export default async function AeonCinemaSimulatorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">🎬</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">イオンシネマ広告シミュレーター</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            98劇場のシネアド（15秒/30秒）・ロビープロモーション料金を概算します（2025年10月改定）
          </p>
        </div>
      </div>
      <AeonCinemaSimulator />
    </div>
  );
}
