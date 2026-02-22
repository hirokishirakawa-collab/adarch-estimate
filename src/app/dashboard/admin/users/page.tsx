import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Shield, Users } from "lucide-react";
import { getAdminUserList } from "@/lib/actions/admin";
import { UserTable } from "@/components/admin/user-table";
import type { UserRole } from "@/types/roles";

export default async function AdminUsersPage() {
  // ── ADMIN ガード ──────────────────────────────────────────────
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const callerEmail = session?.user?.email ?? "";

  // ── データ取得 ─────────────────────────────────────────────────
  const users = await getAdminUserList();

  // ── ロール別カウント ───────────────────────────────────────────
  const counts = {
    ADMIN:   users.filter((u) => u.role === "ADMIN").length,
    MANAGER: users.filter((u) => u.role === "MANAGER").length,
    USER:    users.filter((u) => u.role === "USER").length,
  };

  const summaryCards = [
    { label: "ADMIN（本部）",    count: counts.ADMIN,   cls: "text-amber-700",   bg: "bg-amber-50" },
    { label: "MANAGER（代表）",  count: counts.MANAGER, cls: "text-blue-700",    bg: "bg-blue-50" },
    { label: "USER（一般）",     count: counts.USER,    cls: "text-zinc-600",    bg: "bg-zinc-50" },
    { label: "合計",             count: users.length,   cls: "text-zinc-800",    bg: "bg-white" },
  ];

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Shield className="text-zinc-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">メンバー管理</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            登録済みメンバーのロールを管理します（ADMIN 専用）
          </p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {summaryCards.map(({ label, count, cls, bg }) => (
          <div key={label} className={`${bg} border border-zinc-200 rounded-xl px-4 py-3`}>
            <p className="text-[11px] text-zinc-500 font-semibold mb-0.5">{label}</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${cls}`}>{count}</p>
              <Users className="w-4 h-4 text-zinc-300" />
            </div>
          </div>
        ))}
      </div>

      {/* ユーザーテーブル */}
      <UserTable users={users} callerEmail={callerEmail} />
    </div>
  );
}
