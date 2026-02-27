import { Tv2 } from "lucide-react";
import { TverCampaignForm } from "@/components/tver/TverCampaignForm";
import { createTverCampaign } from "@/lib/actions/tver-campaign";
import { getApprovedAdvertisers } from "@/lib/actions/advertiser-review";

export default async function NewTverCampaignPage() {
  const advertisers = await getApprovedAdvertisers();

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">TVer配信を申請する</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            承認済み広告主のTVer広告配信を申請します
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <TverCampaignForm action={createTverCampaign} advertisers={advertisers} />
      </div>
    </div>
  );
}
