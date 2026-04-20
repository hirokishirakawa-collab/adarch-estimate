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
  if (!isAdmin && !user.enabledFeatures.includes("auto-sales")) {
    redirect("/dashboard");
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
