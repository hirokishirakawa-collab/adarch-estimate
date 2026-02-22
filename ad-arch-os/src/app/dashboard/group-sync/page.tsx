import Link from "next/link";
import { Network, Plus } from "lucide-react";
import { getCollaborationRequestList } from "@/lib/actions/group-sync";
import { CollaborationTable } from "@/components/group-sync/collaboration-table";

export default async function GroupSyncPage() {
  const { requests, role } = await getCollaborationRequestList();

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
            <Network className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">グループ連携依頼</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {role === "ADMIN"
                ? "全拠点のグループ連携依頼を管理します"
                : "拠点間の連携依頼を申請・管理します"}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/group-sync/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white
                     text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新規依頼
        </Link>
      </div>

      <CollaborationTable requests={requests} role={role} />
    </div>
  );
}
