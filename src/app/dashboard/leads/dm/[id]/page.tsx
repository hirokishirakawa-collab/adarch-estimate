import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft, Mailbox } from "lucide-react";
import { DmKitDetail } from "@/components/dm/dm-kit-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DmKitPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const { id } = await params;
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true, groupCompanyId: true } });
  if (!me) redirect("/login");
  const scope = me.role === "ADMIN" ? {} : me.groupCompanyId ? { OR: [{ createdById: me.id }, { groupCompanyId: me.groupCompanyId }] } : { createdById: me.id };
  const kit = await db.dmKit.findFirst({ where: { id, ...scope } });
  if (!kit) notFound();

  return (
    <div className="px-6 py-6 max-w-screen-lg mx-auto w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <Mailbox className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">郵送DMの材料</h2>
            <p className="text-xs text-zinc-500 mt-0.5">再ダウンロード・発送先・発送済みの記録</p>
          </div>
        </div>
        <Link href="/dashboard/leads/dm" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
          <ChevronLeft className="w-3.5 h-3.5" /> 履歴へ
        </Link>
      </div>
      <DmKitDetail
        kit={{
          ...kit,
          createdAt: kit.createdAt.toISOString(),
          sentAt: kit.sentAt ? kit.sentAt.toISOString() : null,
          needsFix: (kit.needsFix as { leadId: string; name: string; address: string; reason: string | null }[] | null) ?? null,
          skipped: (kit.skipped as { leadId: string; name: string; reason: string }[] | null) ?? null,
        }}
      />
    </div>
  );
}
