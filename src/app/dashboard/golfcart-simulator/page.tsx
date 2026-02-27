import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { GolfcartSimulator } from "@/components/golfcart/GolfcartSimulator";

export const metadata = { title: "ゴルフカート広告シミュレーター（Golfcart Vision）" };

export default async function GolfcartSimulatorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Flag className="text-zinc-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">ゴルフカート広告シミュレーター（Golfcart Vision）</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            メニュー・週数・ゴルフ場を選択して掲載費と想定インプレッションを概算します
          </p>
        </div>
      </div>
      <GolfcartSimulator />
    </div>
  );
}
