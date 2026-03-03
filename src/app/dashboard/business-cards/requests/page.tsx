import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { DISCLOSURE_STATUS_OPTIONS } from "@/lib/constants/business-cards";
import { DisclosureReviewForm } from "@/components/business-cards/disclosure-review-form";

export default async function DisclosureRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const info = await getSessionInfo();
  if (!info) redirect("/login");

  // ADMIN は全件、それ以外は自分が所有する名刺への申請 + 自分の申請
  const requests = await db.disclosureRequest.findMany({
    where:
      info.role === "ADMIN"
        ? {}
        : {
            OR: [
              { businessCard: { ownerId: info.userId } },
              { requesterId: info.userId },
            ],
          },
    include: {
      businessCard: {
        select: { id: true, companyName: true, lastName: true, firstName: true, ownerId: true },
      },
      requester: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const canReview = (req: (typeof requests)[0]) =>
    req.status === "PENDING" &&
    (info.role === "ADMIN" || req.businessCard.ownerId === info.userId);

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-xl mx-auto w-full">
      <Link
        href="/dashboard/business-cards"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        名刺一覧に戻る
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <ClipboardList
            style={{ width: "1.125rem", height: "1.125rem" }}
            className="text-amber-600"
          />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">開示申請一覧</h1>
          <p className="text-xs text-zinc-500">
            名刺秘匿情報の開示申請と審査状況
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80">
                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">対象名刺</th>
                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">申請者</th>
                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">目的</th>
                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">ステータス</th>
                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">申請日</th>
                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500">審査</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-400">
                    開示申請はありません
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const statusOpt = DISCLOSURE_STATUS_OPTIONS.find(
                    (o) => o.value === req.status
                  );
                  return (
                    <tr
                      key={req.id}
                      className="border-b border-zinc-50 hover:bg-zinc-50/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/business-cards/${req.businessCard.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {req.businessCard.companyName}
                        </Link>
                        <span className="block text-[10px] text-zinc-400 mt-0.5">
                          {req.businessCard.lastName}{" "}
                          {req.businessCard.firstName ?? ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {req.requester.name ?? req.requester.email}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate">
                        {req.purpose}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusOpt?.color ?? ""}`}
                        >
                          {statusOpt?.label ?? req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-4 py-3">
                        {canReview(req) ? (
                          <DisclosureReviewForm requestId={req.id} />
                        ) : req.reviewedBy ? (
                          <span className="text-[10px] text-zinc-400">
                            {req.reviewedBy.name} が審査
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
