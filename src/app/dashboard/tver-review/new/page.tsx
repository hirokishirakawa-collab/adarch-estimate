import { Tv2 } from "lucide-react";
import { AdvertiserReviewForm } from "@/components/tver/AdvertiserReviewForm";
import { createAdvertiserReview } from "@/lib/actions/advertiser-review";

export default function NewAdvertiserReviewPage() {
  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">業態考査を申請する</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            TVer広告を出稿する広告主の業態考査申請フォームです
          </p>
        </div>
      </div>

      {/* 注意書き */}
      <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>業態考査について：</strong>
          TVer広告を出稿するためには、広告主の業態審査（考査）が必要です。
          申請内容を確認後、管理者から結果をメールでお知らせします。
          承認された広告主のみ、TVer配信申請フォームでご利用いただけます。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <AdvertiserReviewForm action={createAdvertiserReview} />
      </div>
    </div>
  );
}
