import Link from "next/link";
import { Tv2, Plus } from "lucide-react";
import { getAdvertiserReviewList } from "@/lib/actions/advertiser-review";
import { AdvertiserReviewTable } from "@/components/tver/AdvertiserReviewTable";

export default async function TVerReviewPage() {
  const { reviews, role } = await getAdvertiserReviewList();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">TVer広告主 業態考査</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {role === "ADMIN"
                ? "全拠点の業態考査申請を管理します"
                : "TVer広告主の業態考査を申請します"}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/tver-review/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white
                     text-xs font-medium rounded-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規申請
        </Link>
      </div>

      <AdvertiserReviewTable reviews={reviews} role={role} />
    </div>
  );
}
