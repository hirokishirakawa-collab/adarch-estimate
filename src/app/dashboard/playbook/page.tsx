import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PlaybookManager } from "./PlaybookManager";

export default async function PlaybookPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  const isAdmin = user.role === "ADMIN";

  // ── アクセス制御: ADMIN以外は月次報告提出済みかつアクティブであること ──
  if (!isAdmin) {
    if (!user.isActive) redirect("/dashboard");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const report = await db.revenueReport.findFirst({
      where: {
        createdById: user.id,
        targetMonth: { gte: monthStart, lt: monthEnd },
      },
    });
    if (!report) {
      redirect("/dashboard?playbook_blocked=report_missing");
    }
  }

  const [playbooks, guidelines] = await Promise.all([
    db.salesPlaybook.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.salesGuideline.findMany({
      orderBy: { key: "asc" },
    }),
  ]);

  return (
    <PlaybookManager
      initialPlaybooks={JSON.parse(JSON.stringify(playbooks))}
      initialGuidelines={JSON.parse(JSON.stringify(guidelines))}
      isAdmin={isAdmin}
    />
  );
}
