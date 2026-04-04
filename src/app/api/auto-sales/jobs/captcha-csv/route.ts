import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/auto-sales/jobs/captcha-csv
 * CAPTCHAでスキップされた企業をCSVダウンロード
 */
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
  if (user.role !== "ADMIN" && !user.enabledFeatures.includes("auto-sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchFilter = user.role === "ADMIN" ? {} : { branchId: user.branchId! };

  const jobs = await db.autoSalesJob.findMany({
    where: {
      status: "SKIPPED",
      errorMessage: { contains: "CAPTCHAサイトのため手動対応が必要" },
      target: branchFilter,
    },
    include: {
      target: {
        select: { companyName: true, url: true, industry: true, area: true, phone: true },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  // CSV生成（BOM付きUTF-8）
  const bom = "\uFEFF";
  const header = "企業名,URL,業種,エリア,電話番号,CAPTCHA種類,スキップ日時";
  const rows = jobs.map((j) => {
    const captchaType = j.errorMessage?.match(/（(.+?)）/)?.[1] ?? "不明";
    return [
      `"${(j.target.companyName ?? "").replace(/"/g, '""')}"`,
      `"${j.target.url}"`,
      `"${j.target.industry ?? ""}"`,
      `"${j.target.area ?? ""}"`,
      `"${j.target.phone ?? ""}"`,
      `"${captchaType}"`,
      `"${j.completedAt?.toISOString() ?? ""}"`,
    ].join(",");
  });

  const csv = bom + header + "\n" + rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="captcha_manual_targets_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
