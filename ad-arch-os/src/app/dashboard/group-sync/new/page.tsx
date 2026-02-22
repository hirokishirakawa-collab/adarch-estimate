import { Network } from "lucide-react";
import { CollaborationForm } from "@/components/group-sync/collaboration-form";
import { createCollaborationRequest, getProjectsForGroupSync } from "@/lib/actions/group-sync";

export default async function NewGroupSyncPage() {
  const projects = await getProjectsForGroupSync();

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
          <Network className="text-violet-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">グループ連携依頼を作成する</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            他拠点への連携・協力依頼を申請します
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <CollaborationForm action={createCollaborationRequest} projects={projects} />
      </div>
    </div>
  );
}
