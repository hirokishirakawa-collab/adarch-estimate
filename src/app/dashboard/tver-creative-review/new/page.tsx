import Link from "next/link";
import { ArrowLeft, Tv2 } from "lucide-react";
import { getApprovedAdvertisers } from "@/lib/actions/advertiser-review";
import { createTverCreativeReview } from "@/lib/actions/tver-creative-review";
import { TverCreativeReviewForm } from "@/components/tver/TverCreativeReviewForm";

export default async function TverCreativeReviewNewPage() {
  const advertisers = await getApprovedAdvertisers();

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <Link
        href="/dashboard/tver-creative-review"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                   transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />クリエイティブ考査一覧に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <h2 className="text-lg font-bold text-zinc-900">TVer クリエイティブ考査申請</h2>
      </div>

      {advertisers.length === 0 ? (
        <div className="px-5 py-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          承認済み広告主がありません。先にTVer業態考査申請を行い、承認を受けてください。
        </div>
      ) : (
        <TverCreativeReviewForm action={createTverCreativeReview} advertisers={advertisers} />
      )}
    </div>
  );
}
