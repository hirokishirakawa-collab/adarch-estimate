import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
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
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* サイドバー */}
      <Sidebar user={user} />

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 min-w-0">
        <Header pageTitle="ダッシュボード" user={user} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
