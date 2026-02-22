import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Toaster } from "sonner";
import type { UserRole } from "@/types/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = {
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
    role: (session.user?.role ?? "USER") as UserRole,
  };

  return (
    <>
      <DashboardShell user={user}>{children}</DashboardShell>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
