import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// 反響があったテンプレートの訴求文を取得（全拠点共有の成功実績）
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 反響があったジョブのテンプレートを集計
  const successTemplates = await db.autoSalesTemplate.findMany({
    where: {
      jobs: { some: { hasResponse: true } },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      targetType: true,
      serviceTypes: true,
      pitchText: true,
      branch: { select: { name: true } },
      _count: {
        select: {
          jobs: { where: { hasResponse: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 拠点名は匿名化（他拠点の情報は「○○エリア」等で表示）
  const examples = successTemplates.map((t) => ({
    id: t.id,
    branchName: t.branch?.name ?? "不明",
    targetType: t.targetType,
    serviceTypes: t.serviceTypes,
    pitchText: t.pitchText,
    responseCount: t._count.jobs,
  }));

  return NextResponse.json(examples);
}
