import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { getMyGroupThread } from "@/lib/actions/group-support";
import { GroupThreadCard } from "@/components/dashboard/group-thread-card";
import { ForcedInactiveModal } from "@/components/partner-status/forced-inactive-modal";

export async function PersonalInbox() {
  const session = await auth();
  if (!session?.user?.email) return null;
  if (session.user.role === "ADMIN")
    return (
      <section>
        <div className="os-section-head">
          <h2>本部の対応</h2>
        </div>
        <div className="os-action-row">
          <div className="os-action-copy">
            <h3>申請と代表からの依頼</h3>
            <p>承認待ち・未対応の連絡をまとめて確認。</p>
          </div>
          <Link href="/dashboard/admin/workspace">確認 →</Link>
        </div>
      </section>
    );
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { groupCompanyId: true, groupCompany: { select: { name: true } } },
  });
  const now = new Date();
  const date = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth() + 1;
  const [thread, status] = await Promise.all([
    getMyGroupThread()
      .then((value) => ({ value, failed: false }))
      .catch(() => ({ value: null, failed: true })),
    user?.groupCompanyId
      ? db.partnerStatus.findUnique({
          where: {
            groupCompanyId_year_month: {
              groupCompanyId: user.groupCompanyId,
              year,
              month,
            },
          },
          select: { status: true },
        })
      : null,
  ]);
  return (
    <section aria-label="自分への連絡">
      <div className="os-section-head">
        <h2>自分への連絡</h2>
        <span>本人と本部のみ</span>
      </div>
      {status?.status === "FORCED_INACTIVE" && (
        <ForcedInactiveModal
          companyName={user?.groupCompany?.name ?? ""}
          year={year}
          month={month}
        />
      )}
      {thread.failed ? (
        <p className="os-notice">
          本部からの連絡を取得できませんでした。時間をおいて再度開いてください。
        </p>
      ) : thread.value ? (
        <GroupThreadCard
          messages={thread.value.messages.map((m) => ({
            id: m.id,
            type: m.type as "CEO_COMMENT" | "PARTNER_REPLY",
            content: m.content,
            actorName: m.actorName,
            createdAt: m.createdAt.toISOString(),
          }))}
          unreadCount={thread.value.unreadCount}
        />
      ) : (
        <p className="os-description">本部からの連絡はここに表示します。</p>
      )}
      {session.user.role === "MANAGER" &&
        user?.groupCompanyId &&
        (!status || status.status === "NOT_SELECTED") && (
          <Link href="/dashboard/partner-status" className="os-notice block">
            {month}月の稼働ステータスを選択してください →
          </Link>
        )}
      <div className="os-action-row">
        <div className="os-action-copy">
          <h3>報告・請求・自社の手続き</h3>
          <p>提出と確認が必要なものを開く。</p>
        </div>
        <Link href="/dashboard/work/procedures">確認 →</Link>
      </div>
    </section>
  );
}
