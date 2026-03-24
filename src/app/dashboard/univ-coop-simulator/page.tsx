import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UnivCoopSimulator } from "@/components/univ-coop/UnivCoopSimulator";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

export const metadata = { title: "大学生協広告シミュレーター" };

export default async function UnivCoopSimulatorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">🎓</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">大学生協広告シミュレーター</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            食堂・枚数・月数から掲載費・印刷費・発送費・Ad-Arch提示価格を概算します
          </p>
          <WikiHelpLink query="大学生協" />
        </div>
      </div>
      <UnivCoopSimulator />
    </div>
  );
}
