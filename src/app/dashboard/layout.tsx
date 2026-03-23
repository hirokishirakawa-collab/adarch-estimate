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
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") || hdrs.get("x-invoke-path") || "";

  // 月次報告ページのみアクセス許可
  const allowedPaths = ["/dashboard/sales-report"];
  const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));

  if (isAllowed) {
    return <>{children}</>;
  }

  // それ以外は停止案内を表示
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900 mb-2">
            アカウントが一時停止されています
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            月次報告が未提出のため、OSの利用が一時停止されています。
            月次報告を提出いただくと、自動的にアクセスが回復します。
          </p>
        </div>
        <a
          href="/dashboard/sales-report/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          月次報告を提出する
        </a>
      </div>
    </div>
  );
}
