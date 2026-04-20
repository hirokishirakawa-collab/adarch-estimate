import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// プレイブック JSON 取得（ログイン済み全ユーザー）
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

  const isAdmin = user.role === "ADMIN";

  const [playbooks, guidelineRows] = await Promise.all([
    db.salesPlaybook.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.salesGuideline.findMany(),
  ]);

  // ガイドラインを key-value オブジェクトに組み立て
  const guidelines: Record<string, unknown> = {};
  for (const row of guidelineRows) {
    guidelines[row.key] = row.value;
  }

  const today = new Date().toISOString().slice(0, 10);

  return NextResponse.json({
    version: today,
    groupId: "adarch",
    guidelines,
    playbook: playbooks.map((p) => ({
      id: p.id,
      label: p.label,
      targetType: p.targetType,
      industry: p.industry,
      serviceTypes: p.serviceTypes,
      pitchTemplate: p.pitchTemplate,
      approach: p.approach,
      updatedAt: p.updatedAt.toISOString().slice(0, 10),
    })),
    customization: {
      editable: ["pitchTemplate", "approach"],
      locked: ["guidelines", "prohibited"],
      instruction:
        "以下のplaybookを参考に、自社の情報に書き換えて使用してください。guidelines.prohibitedに抵触する変更はしないでください。",
    },
  });
}

// プレイブック作成（ADMIN のみ）
export async function POST(req: NextRequest) {
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
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { label, targetType, industry, serviceTypes, pitchTemplate, approach } =
    body as {
      label: string;
      targetType: string;
      industry?: string;
      serviceTypes: string[];
      pitchTemplate: string;
      approach?: string;
    };

  if (!label || !targetType || !pitchTemplate || !serviceTypes?.length) {
    return NextResponse.json(
      { error: "必須項目を入力してください（label, targetType, pitchTemplate, serviceTypes）" },
      { status: 400 }
    );
  }

  const playbook = await db.salesPlaybook.create({
    data: {
      label,
      targetType,
      industry: industry || null,
      serviceTypes,
      pitchTemplate,
      approach: approach || null,
    },
  });

  return NextResponse.json(playbook, { status: 201 });
}
