import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// 共有リンク生成
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { productionId } = await req.json();

  const production = await prisma.production.findUnique({ where: { id: productionId } });
  if (!production) return NextResponse.json({ error: "Production not found" }, { status: 404 });

  // Generate share token (store in metadata)
  const shareToken = randomBytes(16).toString("hex");
  const existingMeta = typeof production.metadata === "object" && production.metadata !== null
    ? (production.metadata as Record<string, unknown>)
    : {};
  await prisma.production.update({
    where: { id: productionId },
    data: {
      metadata: JSON.parse(JSON.stringify({
        ...existingMeta,
        shareToken,
        sharedAt: new Date().toISOString(),
        sharedBy: user.email,
      })),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "studio_share_created",
      email: user.email,
      name: user.name,
      entity: "production",
      entityId: productionId,
      detail: `共有リンク生成: ${production.title}`,
    },
  });

  return NextResponse.json({
    shareUrl: `/dashboard/studio/share/${shareToken}`,
    token: shareToken,
  });
}
