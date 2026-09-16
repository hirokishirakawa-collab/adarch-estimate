import "./workspace.css";
import "./connected.css";
import localFont from "next/font/local";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SuspendedRedirect } from "@/components/layout/suspended-redirect";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import { WinCelebration } from "@/components/deals/win-celebration";
import { Toaster } from "sonner";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";
import type { ReportBranches } from "@/components/layout/report-branch-switch";

const osFont = localFont({ src: [{path:"./fonts/ibm-plex-sans-jp-regular.woff2",weight:"400"},{path:"./fonts/ibm-plex-sans-jp-semibold.woff2",weight:"600"}], variable:"--font-os",display:"swap",preload:false });

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

  const aiConnected = session.user?.email && isActive
    ? (await db.oAuthGrant.count({ where: { userEmail: session.user.email, revokedAt: null, expiresAt: { gt: new Date() } } })) > 0
    : false;

  const user = {
    aiConnected: !!aiConnected,
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
    role,
    enabledFeatures: session.user?.enabledFeatures ?? [],
  };

  // ── 契約更新チェック（ADMIN以外） ──
  // 2026-08-24 代表決定: 満了による強制停止（/dashboard/contract-expired への
  // リダイレクト）は廃止。90日前からの更新お願いバナーのみ残す。
  let contractDaysLeft: number | null = null;
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

  // ── 報告先の県（2拠点の代表のみ）＝上部の切替に出す ──
  let reportBranches: ReportBranches | null = null;
  if (role !== "ADMIN" && session.user?.email) {
    try {
      const u = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
          branch: { select: { id: true, name: true } },
          branch2: { select: { id: true, name: true } },
        },
      });
      if (u?.branch && u.branch2) reportBranches = { current: u.branch, other: u.branch2 };
    } catch (e) {
      console.error("[layout] Report branch check failed:", e instanceof Error ? e.message : e);
    }
  }

  return (
    <div className={osFont.variable}>
      <DashboardShell user={user} reportWarning={reportWarning} isActive={isActive} contractDaysLeft={contractDaysLeft} reportBranches={reportBranches}>
        {!isActive && <SuspendedRedirect suspendReason={suspendReason} />}
        {children}
      </DashboardShell>
      <ChatbotWidget />
      {isActive && <WinCelebration />}
      <Toaster richColors position="top-right" />
    </div>
  );
}
