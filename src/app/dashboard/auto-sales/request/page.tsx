import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AutoSalesRequestForm } from "./AutoSalesRequestForm";

export default async function AutoSalesRequestPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { branch: { select: { name: true } } },
  });
  if (!user) redirect("/");

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.enabledFeatures.includes("auto-sales")) {
    redirect("/dashboard");
  }

  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };

  const [templates, targetCount] = await Promise.all([
    db.autoSalesTemplate.findMany({
      where: { ...branchFilter, isActive: true },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.autoSalesTarget.count({ where: branchFilter }),
  ]);

  return (
    <AutoSalesRequestForm
      templates={JSON.parse(JSON.stringify(templates))}
      targetCount={targetCount}
      isAdmin={isAdmin}
      branchName={user.branch?.name ?? "本部"}
    />
  );
}
