import { CheckCircle2, XCircle, Info } from "lucide-react";

interface EligibilityProps {
  submissionCount: number;
  requiredWeeks: number;
  hasLatestRevenueReport: boolean;
  latestReportMonth: string;
  canApply: boolean;
}

export function EligibilityCard({
  submissionCount,
  requiredWeeks,
  hasLatestRevenueReport,
  latestReportMonth,
  canApply,
}: EligibilityProps) {
  const weeklyOk = submissionCount >= requiredWeeks;

  return (
    <div
      className={`rounded-lg border p-5 ${
        canApply
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {canApply ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <XCircle className="w-4 h-4 text-amber-600" />
        )}
        <h3 className="text-sm font-semibold text-zinc-900">
          {canApply ? "応募可能です" : "応募条件を満たしていません"}
        </h3>
        <span className="text-[10px] text-zinc-400">
          （この情報はあなただけに表示されています）
        </span>
      </div>

      {/* 条件チェックリスト */}
      <div className="space-y-3 mb-4">
        {/* 条件1: 週次シェア */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: requiredWeeks }).map((_, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                  i < submissionCount
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-200 text-zinc-400"
                }`}
              >
                {i < submissionCount ? "\u2713" : "\u2013"}
              </div>
            ))}
          </div>
          <span className={`text-xs ${weeklyOk ? "text-emerald-700" : "text-amber-700"}`}>
            週次シェア: 直近{requiredWeeks}週中{" "}
            <span className="font-bold">{submissionCount}週</span> 提出済み
          </span>
        </div>

        {/* 条件2: 売上報告 */}
        <div className="flex items-center gap-3">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
              hasLatestRevenueReport
                ? "bg-emerald-500 text-white"
                : "bg-zinc-200 text-zinc-400"
            }`}
          >
            {hasLatestRevenueReport ? "\u2713" : "\u2013"}
          </div>
          <span className={`text-xs ${hasLatestRevenueReport ? "text-emerald-700" : "text-amber-700"}`}>
            売上報告: {latestReportMonth}分{" "}
            {hasLatestRevenueReport ? "提出済み" : "未提出"}
          </span>
          {!hasLatestRevenueReport && (
            <a
              href="/dashboard/sales-report"
              className="text-[10px] text-blue-600 hover:underline"
            >
              売上報告へ
            </a>
          )}
        </div>
      </div>

      {/* 応募条件の説明 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-zinc-400" />
          <p className="text-[11px] font-medium text-zinc-500">応募条件</p>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-zinc-600">
            直近{requiredWeeks}週の週次シェアをすべて提出していること
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-zinc-600">
            最新月（{latestReportMonth}）の売上報告を提出していること（金額は問いません）
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 ml-3.5">
          グループ活動に継続的に参加している企業が案件に応募できます。
          売上規模や参加時期は関係ありません。
        </p>
      </div>
    </div>
  );
}
