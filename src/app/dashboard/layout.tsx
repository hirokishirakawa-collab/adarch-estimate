import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SuspendedRedirect } from "@/components/layout/suspended-redirect";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { Toaster } from "sonner";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isActive = session.user?.isActive ?? true;
  const role = (session.user?.role ?? "USER") as UserRole;

  const user = {
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
    role,
    enabledFeatures: session.user?.enabledFeatures ?? [],
  };

  // ── 月次報告チェック（ADMIN以外） ──
  let reportWarning: "yellow" | "red" | null = null;
  if (role !== "ADMIN") {
    try {
      const now = new Date();
      const dbUser = await db.user.findUnique({
        where: { email: session?.user?.email ?? "" },
        select: { id: true },
      });
      if (dbUser) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const report = await db.revenueReport.findFirst({
          where: { createdById: dbUser.id, targetMonth: { gte: monthStart, lt: monthEnd } },
        });
        if (!report) {
          const day = now.getDate();
          if (day >= 28) {
            reportWarning = "red";
          } else if (day >= 25) {
            reportWarning = "yellow";
          }
        }
      }
    } catch (e) {
      console.error("[layout] Report check failed:", e instanceof Error ? e.message : e);
    }
  }

  return (
    <>
      <DashboardShell user={user} reportWarning={reportWarning} isActive={isActive}>
        {!isActive && <SuspendedRedirect />}
        {children}
      </DashboardShell>
      <ChatbotWidget />
      <Toaster richColors position="top-right" />
    </>
  );
}
