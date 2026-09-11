import { db } from "@/lib/db";
import { notifyAdmins, createInAppNotification } from "@/lib/notifications";

// ---------------------------------------------------------------
// 受注時にプロジェクトを自動作成する
//   OS画面（src/lib/actions/deal.ts）とAI連携（src/lib/mcp/os-write-tools.ts）の両方から呼ぶ。
//   "use server" のファイルに置くとクライアントから呼べるアクションになってしまうため、ここに分けている。
// ---------------------------------------------------------------
export async function createProjectFromDeal(dealId: string, staffName: string) {
  try {
    // 既にプロジェクトが紐づいていれば何もしない
    const existing = await db.project.findFirst({ where: { dealId } });
    if (existing) return;

    const deal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTo: { select: { name: true } },
      },
    });
    if (!deal) return;

    const project = await db.project.create({
      data: {
        title: deal.title,
        status: "ORDERED",
        budget: deal.amount,
        customerId: deal.customerId,
        branchId: deal.branchId,
        staffName: deal.assignedTo?.name ?? staffName,
        dealId: deal.id,
        description: `商談「${deal.title}」から自動作成`,
      },
    });

    // ログ
    await db.projectLog.create({
      data: {
        projectId: project.id,
        type: "SYSTEM",
        content: `商談「${deal.title}」の受注により自動作成`,
        staffName: "SYSTEM",
      },
    });

    console.log(`[createProjectFromDeal] Created project ${project.id} from deal ${dealId}`);

    // Notify assignee
    if (deal.assignedTo) {
      const assignee = await db.user.findFirst({ where: { name: deal.assignedTo.name }, select: { id: true } });
      if (assignee) {
        createInAppNotification({
          userId: assignee.id,
          type: "PROJECT_CREATED",
          title: `プロジェクト自動作成: ${project.title}`,
          linkUrl: `/dashboard/projects/${project.id}`,
        }).catch(() => {});
      }
    }

    notifyAdmins({
      type: "PROJECT_CREATED",
      title: `プロジェクト自動作成: ${project.title}`,
      message: `商談「${deal.title}」から`,
      linkUrl: `/dashboard/projects/${project.id}`,
    }).catch(() => {});
  } catch (e) {
    console.error("[createProjectFromDeal]", e);
  }
}
