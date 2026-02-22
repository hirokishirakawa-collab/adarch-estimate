import { Megaphone } from "lucide-react";
import { MediaRequestForm } from "@/components/media/media-request-form";
import { createMediaRequest, getCustomersForMedia } from "@/lib/actions/media";

export default async function NewMediaPage() {
  const customers = await getCustomersForMedia();

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <Megaphone className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">媒体依頼を作成する</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            媒体広告の掲載依頼を申請します
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <MediaRequestForm action={createMediaRequest} customers={customers} />
      </div>
    </div>
  );
}
