import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AutoSalesRequestForm } from "./AutoSalesRequestForm";

export default async function AutoSalesRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.showArchived === "true";
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { branch: { select: { name: true } } },
  });
  if (!user) redirect("/");

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const [templates, otherTemplates, targetCount, targets] = await Promise.all([
    // 自分の拠点のテンプレート
    db.autoSalesTemplate.findMany({
      where: { ...branchFilter, isActive: true },
      include: { branch: { select: { name: true } } },
      // 未承認（＝申請中・差戻し）を先頭に。本部が捌く順序をそのまま画面順にする。
      orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
    }),
    // 他拠点のテンプレート（閲覧用）
    isAdmin ? Promise.resolve([]) : db.autoSalesTemplate.findMany({
      where: { isActive: true, NOT: { branchId: user.branchId! } },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.autoSalesTarget.count({ where: branchFilter }),
    db.autoSalesTarget.findMany({
      where: { ...branchFilter, isArchived: showArchived },
      include: {
        jobs: {
          select: { status: true, completedAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <AutoSalesRequestForm
      templates={JSON.parse(JSON.stringify(templates))}
      otherTemplates={JSON.parse(JSON.stringify(otherTemplates))}
      targetCount={targetCount}
      targets={JSON.parse(JSON.stringify(targets))}
      isAdmin={isAdmin}
      branchName={user.branch?.name ?? "本部"}
      showArchived={showArchived}
    />
  );
}
