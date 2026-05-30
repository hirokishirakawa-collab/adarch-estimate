import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Building2, AlertTriangle } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { PartnerBillingTable } from "./partner-billing-table";

export default async function AdminPartnerBillingPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      ownerName: true,
      registeredName: true,
      branchLabels: true,
      royaltyMinExclTax: true,
      royaltyExempt: true,
      entityType: true,
      corporateNumber: true,
      invoiceNumber: true,
      invoiceRegistered: true,
      bankName: true,
      bankBranch: true,
      bankAccountType: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      contractEndDate: true,
      contractRenewed: true,
    },
    orderBy: { name: "asc" },
  });

  const counts = {
    total: companies.length,
    corporation: companies.filter((c) => c.entityType === "CORPORATION").length,
    soleProprietor: companies.filter((c) => c.entityType === "SOLE_PROPRIETOR").length,
    unknown: companies.filter((c) => c.entityType === "UNKNOWN").length,
    invoiceRegistered: companies.filter((c) => c.invoiceRegistered).length,
    bankRegistered: companies.filter((c) => c.bankName && c.bankAccountNumber).length,
  };

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Building2
            className="text-indigo-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            パートナー経理管理
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            法人区分・インボイス登録・振込先口座（ADMIN専用）
          </p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="全パートナー" count={counts.total} cls="text-zinc-800" bg="bg-white" />
        <SummaryCard label="法人" count={counts.corporation} cls="text-blue-700" bg="bg-blue-50" />
        <SummaryCard label="個人事業主" count={counts.soleProprietor} cls="text-amber-700" bg="bg-amber-50" />
        <SummaryCard label="未確認" count={counts.unknown} cls="text-red-700" bg="bg-red-50" />
        <SummaryCard label="インボイス登録済" count={counts.invoiceRegistered} cls="text-emerald-700" bg="bg-emerald-50" />
        <SummaryCard label="口座登録済" count={counts.bankRegistered} cls="text-violet-700" bg="bg-violet-50" />
      </div>

      {/* インボイス経過措置アラート */}
      <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800 space-y-1">
            <p className="font-semibold">インボイス制度 経過措置</p>
            <p>現在（〜2026/9）: 未登録者への支払いは消費税の<strong>20%が控除不可</strong>（80%は控除可能）</p>
            <p>2026/10〜2029/9: 控除不可割合が<strong>50%に拡大</strong></p>
            <p>2029/10〜: <strong>全額控除不可</strong></p>
            <p className="pt-1">個人事業主 × インボイス未登録のパートナーには、源泉徴収に加えて控除不可消費税分の調整が必要です。</p>
          </div>
        </div>
      </div>

      <PartnerBillingTable companies={companies} />
    </div>
  );
}

function SummaryCard({
  label,
  count,
  cls,
  bg,
}: {
  label: string;
  count: number;
  cls: string;
  bg: string;
}) {
  return (
    <div className={`${bg} border border-zinc-200 rounded-xl px-4 py-3`}>
      <p className="text-[11px] text-zinc-500 font-semibold mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${cls}`}>{count}</p>
    </div>
  );
}
