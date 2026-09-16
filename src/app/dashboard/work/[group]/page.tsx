import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import {
  NAVIGATION_ITEMS,
  canUseNavigation,
  type NavigationGroup,
} from "@/lib/navigation/catalog";
import { WorkspaceHub } from "@/components/workspace/workspace-hub";
import type { UserRole } from "@/types/roles";

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
  return <WorkspaceHub group={group as NavigationGroup} items={items} />;
}
