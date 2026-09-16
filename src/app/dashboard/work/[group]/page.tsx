import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import {
  NAVIGATION_ITEMS,
  canUseNavigation,
  type NavigationGroup,
} from "@/lib/navigation/catalog";
import { WorkspaceHub } from "@/components/workspace/workspace-hub";
import type { UserRole } from "@/types/roles";
import Link from "next/link";

export default async function WorkHubPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;
  if (!["sales", "projects", "library", "procedures"].includes(group))
    notFound();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.isActive === false && session.user.role !== "ADMIN")
    redirect("/dashboard/sales-report");
  const role = (session.user.role ?? "USER") as UserRole;
  const items = NAVIGATION_ITEMS.filter(
    (item) =>
      item.group === group &&
      canUseNavigation(
        item,
        role,
        session.user.enabledFeatures,
        session.user.isActive === false,
      ),
  );
  return (
    <WorkspaceHub group={group as NavigationGroup} items={items}>
      {group === "sales" && (
        <div className="os-start-links">
          <Link href="/dashboard/leads/list">見込み先を開く →</Link>
          <Link href="/dashboard/customers">顧客の続きを開く →</Link>
          <Link href="/dashboard/leads/awaiting">返事・結果を記録 →</Link>
        </div>
      )}
      {group === "projects" && (
        <div className="os-start-links">
          <Link href="/dashboard/projects">進行中の案件 →</Link>
          <Link href="/dashboard/tver">広告主ごとのTVer状況 →</Link>
        </div>
      )}
      {group === "library" && (
        <div className="os-start-links">
          <Link href="/dashboard/library">資料・手順を横断検索 →</Link>
          <Link href="/dashboard/knowledge">資料の内容をAIに聞く →</Link>
        </div>
      )}
      {group === "procedures" && (
        <div className="os-start-links">
          <Link href="/dashboard/procedures">自社の提出・連絡を確認 →</Link>
        </div>
      )}
    </WorkspaceHub>
  );
}
