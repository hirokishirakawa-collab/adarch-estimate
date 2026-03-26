import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { Toaster } from "sonner";
import type { UserRole } from "@/types/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isActive = session.user?.isActive ?? true;

  const user = {
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
    role: (session.user?.role ?? "USER") as UserRole,
    enabledFeatures: session.user?.enabledFeatures ?? [],
  };

  return (
    <>
      <DashboardShell user={user}>
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
