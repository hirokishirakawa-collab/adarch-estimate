// ==============================================================
// PUT /api/violation-reports/:id — 違反通報のステータス更新（ADMIN専用）
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const body = (await req.json()) as {
      status: string;
      adminNote?: string;
    };

    if (!body.status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    const validStatuses = [
      "PENDING",
      "REVIEWING",
      "CONFIRMED",
      "DISMISSED",
      "RESOLVED",
    ];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // 通報レコードの存在チェック
    const existing = await db.violationReport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const updated = await db.violationReport.update({
      where: { id },
      data: {
        status: body.status as
          | "PENDING"
          | "REVIEWING"
          | "CONFIRMED"
          | "DISMISSED"
          | "RESOLVED",
        adminNote: body.adminNote ?? existing.adminNote,
      },
    });

    return NextResponse.json({ report: updated });
  } catch (e) {
    console.error("[violation-reports/:id PUT] Error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
