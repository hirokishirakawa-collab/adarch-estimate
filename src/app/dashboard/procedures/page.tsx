import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PersonalInbox } from "@/components/workspace/personal-inbox";
import { NAVIGATION_ITEMS, canUseNavigation } from "@/lib/navigation/catalog";
import { WorkspaceHub } from "@/components/workspace/workspace-hub";
import type { UserRole } from "@/types/roles";
export default async function ProceduresPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user.role ?? "USER") as UserRole;
  const items = NAVIGATION_ITEMS.filter(
    (i) =>
      i.group === "procedures" &&
      canUseNavigation(
        i,
        role,
        session.user.enabledFeatures,
        session.user.isActive === false,
      ),
  );
  return (
    <WorkspaceHub group="procedures" items={items}>
      <PersonalInbox />
    </WorkspaceHub>
  );
}
