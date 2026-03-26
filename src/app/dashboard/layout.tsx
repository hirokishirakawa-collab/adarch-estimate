import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
    const now = new Date();
    const dbUser = await db.user.findUnique({
      where: { email: session?.user?.email ?? "" },
      select: { id: true },
    });
    if (dbUser) {
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const report = await db.revenueReport.findFirst({
        where: { createdById: dbUser.id, targetMonth: currentMonth },
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
  }

  return (
    <>
      <DashboardShell user={user} reportWarning={reportWarning}>
        {isActive ? (
          children
        ) : (
          <SuspendedGuard>{children}</SuspendedGuard>
        )}
      </DashboardShell>
      <ChatbotWidget />
      <Toaster richColors position="top-right" />
    </>
  );
}

async function SuspendedGuard({ children }: { children: React.ReactNode }) {
  const { headers } = await import("next/headers");
  const { redirect: navRedirect } = await import("next/navigation");
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") || hdrs.get("x-invoke-path") || "";

  // 月次報告ページのみアクセス許可
  const allowedPaths = ["/dashboard/sales-report"];
  const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));

  if (isAllowed) {
    return <>{children}</>;
  }

  // 月次報告ページに直行リダイレクト
  navRedirect("/dashboard/sales-report/new?suspended=1");
}
