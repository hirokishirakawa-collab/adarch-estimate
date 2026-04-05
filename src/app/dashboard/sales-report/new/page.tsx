import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RevenueReportForm } from "@/components/sales-report/revenue-report-form";
import { createRevenueReport } from "@/lib/actions/sales-report";
import { BarChart2 } from "lucide-react";

export default async function NewSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const isSuspended = params.suspended === "1" || session?.user?.isActive === false;

  // 累積停止回数を取得（警告メッセージの段階切り替えに使用）
  let suspendCount = 0;
  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { suspendCount: true },
    });
    suspendCount = user?.suspendCount ?? 0;
  }

  // 停止中ユーザーには前月をデフォルトに
  let defaultMonth: string | undefined;
  if (isSuspended) {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    defaultMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 停止中バナー */}
      {isSuspended && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              {suspendCount <= 1 ? (
                <>
                  <p className="text-sm font-bold text-red-800">アカウントが一時停止されています（1回目）</p>
                  <p className="text-xs text-red-600 mt-0.5">月次報告を提出すると、自動的にアクセスが回復します。</p>
                </>
              ) : suspendCount === 2 ? (
                <>
                  <p className="text-sm font-bold text-red-800">月次未報告が2回目となりました</p>
                  <p className="text-xs text-red-700 mt-1.5 leading-relaxed">
                    次回同様の状況が続いた際は、契約書第14条(5)「その他、パートナーとして事業継続が困難と判断される」
                    に該当し、<strong>契約解除</strong>とさせていただきます。
                  </p>
                  <p className="text-xs text-red-600 mt-2">月次報告を提出すると、アクセスが回復します。</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-red-800">月次未報告が3回目となりました</p>
                  <p className="text-xs text-red-700 mt-1.5 leading-relaxed">
                    契約書第14条(5)「その他、パートナーとして事業継続が困難と判断される」
                    に該当するため、<strong>契約解除の対象</strong>となります。
                    本部より別途ご連絡いたします。
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <BarChart2 className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">月次報告を作成</h2>
          <p className="text-xs text-zinc-500 mt-0.5">毎月の状況を共有してください。売上が0円の月も報告をお願いします。</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <RevenueReportForm action={createRevenueReport} defaultValues={defaultMonth ? { targetMonth: defaultMonth } : undefined} />
      </div>
    </div>
  );
}
