import { auth } from "@/lib/auth";
import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { NewCustomerForm } from "@/components/customers/new-customer-form";

export default async function NewCustomerPage() {
  const session = await auth();
  const userName = session?.user?.name ?? session?.user?.email ?? "不明";
  const userEmail = session?.user?.email ?? "";

  return (
    <div className="px-6 py-6 space-y-5 max-w-2xl mx-auto w-full">
      {/* パンくず */}
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        顧客一覧に戻る
      </Link>

      {/* ページヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <UserPlus
            className="text-blue-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">新規顧客登録</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            kintone 項目に準拠したフォームで顧客情報を登録します
          </p>
        </div>
      </div>

      {/* フォームカード */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <NewCustomerForm userName={userName} userEmail={userEmail} />
      </div>
    </div>
  );
}
