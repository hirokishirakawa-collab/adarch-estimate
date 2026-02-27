import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Tv2 } from "lucide-react";
import { OmoChannelSimulator } from "@/components/omochannel/OmoChannelSimulator";

export const metadata = { title: "おもチャンネル（アパホテル）シミュレーター" };

export default async function OmoChannelSimulatorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Tv2 className="text-zinc-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">おもチャンネル（アパホテル）シミュレーター</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            ターゲット・エリア・期間を選択して掲載費を概算します（全52,963室）
          </p>
        </div>
      </div>
      <OmoChannelSimulator />
    </div>
  );
}
