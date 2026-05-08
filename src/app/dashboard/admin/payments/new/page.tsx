import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Banknote } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { createPaymentStatement, getPartnersForSelect } from "@/lib/actions/payment-statement";
import { PaymentStatementForm } from "../payment-statement-form";

export default async function NewPaymentPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const partners = await getPartnersForSelect();

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
          <Banknote className="text-emerald-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">支払明細を作成</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            クライアントからの入金に対して、パートナーへの支払明細を作成します
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <PaymentStatementForm
          action={createPaymentStatement}
          partners={partners}
        />
      </div>
    </div>
  );
}
