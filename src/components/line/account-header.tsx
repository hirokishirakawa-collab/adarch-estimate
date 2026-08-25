import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { AccountNav } from "@/components/line/account-nav";

export function AccountHeader({ account }: { account: { id: string; name: string; basicId: string | null } }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
          <MessageCircle className="text-emerald-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <p className="text-[11px] text-zinc-400">
            <Link href="/dashboard/line" className="hover:underline">LINE公式アカウント</Link>
            {account.basicId ? ` ・ ${account.basicId}` : ""}
          </p>
          <h2 className="text-lg font-bold text-zinc-900">{account.name}</h2>
        </div>
      </div>
      <AccountNav accountId={account.id} />
    </div>
  );
}
