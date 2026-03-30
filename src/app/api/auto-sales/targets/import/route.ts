import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || !user.branchId) {
    return NextResponse.json({ error: "Branch not assigned" }, { status: 400 });
  }
  if (user.role !== "ADMIN" && !user.enabledFeatures.includes("auto-sales")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { targets } = body as {
    targets: Array<{
      companyName: string;
      url: string;
      industry?: string;
      area?: string;
      phone?: string;
    }>;
  };

  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json(
      { error: "targets array is required" },
      { status: 400 }
    );
  }

  // Filter out entries without required fields
  const valid = targets.filter((t) => t.companyName && t.url);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const t of valid) {
    try {
      // Validate URL
      let url = t.url.trim();
      if (!url.startsWith("http")) url = "https://" + url;
      new URL(url); // validate

      // Blacklist check
      const domain = new URL(url).hostname;
      const blacklisted = await db.autoSalesBlacklist.findUnique({
        where: { domain },
      });
      if (blacklisted) {
        skipped++;
        errors.push(`${t.companyName}: ブラックリスト`);
        continue;
      }

      // Duplicate check
      const existing = await db.autoSalesTarget.findUnique({
        where: { branchId_url: { branchId: user.branchId, url } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await db.autoSalesTarget.create({
        data: {
          branchId: user.branchId,
          companyName: t.companyName.trim(),
          url,
          industry: t.industry?.trim() || null,
          area: t.area?.trim() || null,
          phone: t.phone?.trim() || null,
          createdById: user.id,
        },
      });
      created++;
    } catch (err) {
      skipped++;
      errors.push(
        `${t.companyName}: ${err instanceof Error ? err.message : "登録エラー"}`
      );
    }
  }

  return NextResponse.json({
    created,
    skipped,
    total: valid.length,
    errors: errors.slice(0, 10), // Max 10 error messages
  });
}
