import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { DisclosureRequestForm } from "@/components/business-cards/disclosure-request-button";

export default async function DisclosureRequestPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const { id } = await props.params;

  const card = await db.businessCard.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      lastName: true,
      firstName: true,
      department: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
  });

  if (!card) notFound();

  // 自分の名刺 or ADMIN はリダイレクト
  if (card.ownerId === info.userId || info.role === "ADMIN") {
    redirect(`/dashboard/business-cards/${id}`);
  }

  // 既存申請チェック
  const existing = await db.disclosureRequest.findUnique({
    where: {
      businessCardId_requesterId: {
        businessCardId: id,
        requesterId: info.userId,
      },
    },
  });

  if (existing) {
    redirect(`/dashboard/business-cards/${id}`);
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-sm mx-auto w-full">
      <Link
        href={`/dashboard/business-cards/${id}`}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        名刺詳細に戻る
      </Link>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-600" />
            <h1 className="text-sm font-bold text-zinc-900">
              秘匿情報の開示申請
            </h1>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-zinc-50 rounded-lg p-3">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
              対象名刺
            </p>
            <p className="text-sm font-medium text-zinc-700">
              {card.companyName}
            </p>
          </div>

          <DisclosureRequestForm businessCardId={card.id} />
        </div>
      </div>
    </div>
  );
}
