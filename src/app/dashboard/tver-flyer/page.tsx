import Link from "next/link";
import { Tv2, Plus } from "lucide-react";
import { getTverFlyerList } from "@/lib/actions/tver-flyer";
import { FlyerRequestTable } from "@/components/tver-flyer/flyer-request-table";

export default async function TverFlyerPage() {
  const { requests, role } = await getTverFlyerList();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Tv2 className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">TVerチラシ制作サポート</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {role === "ADMIN"
                ? "各拠点からの依頼を受けて、商圏の数値入りチラシ（A4）を作成・納品します"
                : "商圏（市区町村）を指定するだけで、本部がTVer商圏網羅プランの数値入りチラシ（A4）を作成します"}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/tver-flyer/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規依頼
        </Link>
      </div>

      <FlyerRequestTable requests={requests} role={role} />
    </div>
  );
}
