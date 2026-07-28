import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SuspendedRedirect } from "@/components/layout/suspended-redirect";
import { ContractExpiredRedirect } from "@/components/layout/contract-expired-redirect";
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

  // 停止理由を取得（非ADMIN・非アクティブのみ）
  let suspendReason: string | null = null;
  if (!isActive && role !== "ADMIN" && session.user?.email) {
    const dbUser = await db.user.findUnique({
      where: { email: session.user.email },
      select: { suspendReason: true },
    });
    suspendReason = dbUser?.suspendReason ?? null;
  }

  const user = {
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
    role,
    enabledFeatures: session.user?.enabledFeatures ?? [],
  };

  // ── 契約更新チェック（ADMIN以外） ──
  let contractDaysLeft: number | null = null;
  let contractExpired = false;
  if (role !== "ADMIN" && session.user?.email) {
    try {
      const userGc = await db.user.findUnique({
        where: { email: session.user.email },
        select: { groupCompany: { select: { contractEndDate: true, contractRenewed: true } } },
      });
      const gc = userGc?.groupCompany;
      // 次期更新確認済み（contractRenewed）なら満了バナー・強制リダイレクトの対象外
      if (gc?.contractEndDate && !gc.contractRenewed) {
        const now = new Date();
        const diff = gc.contractEndDate.getTime() - now.getTime();
        contractDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (contractDaysLeft <= 0 && !gc.contractRenewed) {
          contractExpired = true;
        }
      }
    } catch (e) {
      console.error("[layout] Contract check failed:", e instanceof Error ? e.message : e);
    }
  }

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
      <DashboardShell user={user} reportWarning={reportWarning} isActive={isActive} contractDaysLeft={contractDaysLeft}>
        {!isActive && <SuspendedRedirect suspendReason={suspendReason} />}
        {contractExpired && <ContractExpiredRedirect />}
        {children}
      </DashboardShell>
      <ChatbotWidget />
      <Toaster richColors position="top-right" />
    </>
  );
}
