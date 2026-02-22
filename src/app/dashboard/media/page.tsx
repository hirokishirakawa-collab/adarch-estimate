import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { getMediaRequestList } from "@/lib/actions/media";
import { MediaRequestTable } from "@/components/media/media-request-table";

export default async function MediaPage() {
  const { requests, role } = await getMediaRequestList();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <Megaphone className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">媒体依頼</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {role === "ADMIN"
                ? "全拠点の媒体広告掲載依頼を管理します"
                : "媒体広告の掲載依頼を申請・管理します"}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/media/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white
                     text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規依頼
        </Link>
      </div>

      <MediaRequestTable requests={requests} role={role} />
    </div>
  );
}
