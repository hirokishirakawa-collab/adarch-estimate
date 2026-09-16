import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { WorkspaceHub } from "@/components/workspace/workspace-hub";
import { NAVIGATION_ITEMS, canUseNavigation } from "@/lib/navigation/catalog";

export default async function AdminWorkspacePage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.email)
    redirect("/dashboard");
  const viewer = await loadViewer(session.user.email);
  if (viewer?.role !== "ADMIN") redirect("/dashboard");
  const [reviews, creatives, campaigns, notifications] = await Promise.all([
    db.advertiserReview.count({ where: { status: "PENDING" } }),
    db.tverCreativeReview.count({ where: { status: "SUBMITTED" } }),
    db.tverCampaign.count({ where: { status: "SUBMITTED" } }),
    db.notification.findMany({
      where: { userId: viewer.id, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, linkUrl: true, createdAt: true },
    }),
  ]);
  const items = NAVIGATION_ITEMS.filter(
    (item) => item.group === "admin" && canUseNavigation(item, "ADMIN"),
  );
  return (
    <WorkspaceHub group="admin" items={items}>
      <section className="os-admin-queue">
        <h2>審査・確認待ち</h2>
        <div className="os-admin-counts">
          {[
            {
              label: "業態考査",
              count: reviews,
              href: "/dashboard/tver-review",
            },
            {
              label: "素材考査",
              count: creatives,
              href: "/dashboard/tver-creative-review",
            },
            {
              label: "配信申請",
              count: campaigns,
              href: "/dashboard/tver-campaign",
            },
          ].map((row) => (
            <Link href={row.href} key={row.href}>
              <span>{row.label}</span>
              <strong>
                {row.count}
                <small>件</small>
              </strong>
            </Link>
          ))}
        </div>
        <div className="os-start-links">
          <Link href="/dashboard/group-support">代表の週次・依頼を確認 →</Link>
          <Link href="/dashboard/admin/partner-status">
            稼働・未提出を確認 →
          </Link>
        </div>
        <h2>自分宛ての未読通知</h2>
        {notifications.length ? (
          notifications.map((row) => (
            <div className="os-action-row" key={row.id}>
              <div className="os-action-copy">
                <h3>{row.title}</h3>
                <p>
                  {row.createdAt.toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                  })}
                </p>
              </div>
              {row.linkUrl?.startsWith("/dashboard/") &&
                !row.linkUrl.includes("..") && (
                  <Link href={row.linkUrl}>開く →</Link>
                )}
            </div>
          ))
        ) : (
          <p className="os-empty">未読通知はありません。</p>
        )}
        <p className="os-footnote">
          直近10件。全文・既読操作は右上の通知から確認できます。
        </p>
      </section>
    </WorkspaceHub>
  );
}
