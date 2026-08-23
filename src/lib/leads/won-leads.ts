// ---------------------------------------------------------------
// 「受注」ボタンを押したのに、まだ月次報告の明細に入っていないリード。
//   月次報告の新規/編集画面の「取り込み」パネルと、一覧の注意表示に使う。
//   自分が担当（assignee）のリードだけを返す＝他拠点の受注は見えない。
// ---------------------------------------------------------------
import { db } from "@/lib/db";
import type { WonLead } from "@/components/sales-report/revenue-item-editor";

export async function findUnreportedWonLeads(userId: string, excludeReportId?: string): Promise<WonLead[]> {
  const leads = await db.lead.findMany({
    where: {
      assigneeId: userId,
      outreachResult: "WON",
      // どの報告にも入っていない（編集中の報告に入っている分は「取り込み済み」として除く）
      revenueItems: excludeReportId ? { none: { reportId: { not: excludeReportId } } } : { none: {} },
    },
    select: { id: true, name: true, industry: true, outreachResultAt: true },
    orderBy: { outreachResultAt: "desc" },
    take: 50,
  });
  return leads.map((l) => ({
    id: l.id,
    name: l.name,
    industry: l.industry,
    wonAt: l.outreachResultAt ? `${l.outreachResultAt.getMonth() + 1}/${l.outreachResultAt.getDate()}` : "",
  }));
}
