import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Activity } from "lucide-react";
import { PartnerStatusSelector } from "@/components/partner-status/status-selector";

export default async function PartnerStatusPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  // ユーザーと所属企業を取得
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { groupCompanyId: true, groupCompany: { select: { name: true } } },
  });

  // パートナー未登録の場合
  if (!user?.groupCompanyId) {
    return (
      <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
            <Activity
              className="text-zinc-600"
              style={{ width: "1.125rem", height: "1.125rem" }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              稼働ステータス
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              月次の稼働ステータスを選択してください
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">
            パートナー登録が必要です
          </p>
          <p className="text-xs text-amber-600 mt-1">
            この機能を利用するには、グループ企業への紐付けが必要です。本部にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 当月のステータスを取得（なければ自動作成）
  const currentStatus = await db.partnerStatus.upsert({
    where: {
      groupCompanyId_year_month: {
        groupCompanyId: user.groupCompanyId,
        year,
        month,
      },
    },
    create: {
      groupCompanyId: user.groupCompanyId,
      year,
      month,
      status: "NOT_SELECTED",
    },
    update: {},
    include: {
      groupCompany: { select: { name: true, ownerName: true } },
    },
  });

  // 変更履歴（直近6ヶ月分）
  const sixMonthsAgo = new Date(year, month - 7, 1);
  const logs = await db.partnerStatusLog.findMany({
    where: {
      groupCompanyId: user.groupCompanyId,
      createdAt: { gte: sixMonthsAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // シリアライズ
  const serializedStatus = {
    ...currentStatus,
    selectedAt: currentStatus.selectedAt?.toISOString() ?? null,
    createdAt: currentStatus.createdAt.toISOString(),
    updatedAt: currentStatus.updatedAt.toISOString(),
  };

  const serializedLogs = logs.map((l) => ({
    id: l.id,
    fromStatus: l.fromStatus,
    toStatus: l.toStatus,
    reason: l.reason,
    changedBy: l.changedBy,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Activity
            className="text-zinc-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">稼働ステータス</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            月次の稼働ステータスを選択してください
          </p>
        </div>
      </div>

      {/* インタラクティブ部分 */}
      <PartnerStatusSelector
        initialStatus={serializedStatus as never}
        logs={serializedLogs}
        companyName={user.groupCompany?.name ?? ""}
      />
    </div>
  );
}
