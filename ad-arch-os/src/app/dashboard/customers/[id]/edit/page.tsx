import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ChevronLeft, Pencil } from "lucide-react";
import { EditCustomerForm } from "@/components/customers/edit-customer-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerEditPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const staffName = session?.user?.name ?? session?.user?.email ?? "不明";

  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  return (
    <div className="px-6 py-6 space-y-4 max-w-3xl mx-auto w-full">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link
          href="/dashboard/customers"
          className="hover:text-zinc-800 transition-colors"
        >
          顧客管理
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/customers/${id}`}
          className="hover:text-zinc-800 transition-colors"
        >
          {customer.name}
        </Link>
        <span>/</span>
        <span className="text-zinc-400">編集</span>
      </div>

      {/* ページタイトル */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <Pencil
            className="text-blue-600"
            style={{ width: "1rem", height: "1rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">顧客情報を編集</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            変更した項目は自動的に活動履歴に記録されます
          </p>
        </div>
      </div>

      {/* 戻るリンク */}
      <Link
        href={`/dashboard/customers/${id}`}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        詳細ページに戻る
      </Link>

      {/* 編集フォーム */}
      <div className="bg-white rounded-xl border border-zinc-200 px-6 py-6">
        <EditCustomerForm customer={customer} staffName={staffName} />
      </div>
    </div>
  );
}
