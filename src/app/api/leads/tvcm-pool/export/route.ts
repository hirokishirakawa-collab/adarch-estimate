"use server";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLeadStatusOption } from "@/lib/constants/leads";

// ---------------------------------------------------------------
// GET /api/leads/tvcm-pool/export
// TVer案件プールで「手をあげた（claim済み）」案件をCSV出力する。
// ADMIN: 全パートナーのclaim案件 / それ以外: 自分のclaim案件のみ
// ---------------------------------------------------------------
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isAdmin = user.role === "ADMIN";

  const leads = await db.lead.findMany({
    where: {
      source: "PR_TIMES_TVCM",
      assigneeId: isAdmin ? { not: null } : user.id,
    },
    include: {
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return generateCsv(leads);
}

type LeadRow = Awaited<ReturnType<typeof db.lead.findMany>>[number] & {
  assignee: { name: string | null; email: string } | null;
};

function generateCsv(leads: LeadRow[]) {
  const header = [
    "会社名",
    "都道府県",
    "住所",
    "業種",
    "ステータス",
    "担当パートナー",
    "PRタイトル",
    "動画URL",
    "制作会社",
    "プレスリリースURL",
    "Webサイト",
    "資本金",
    "従業員数",
    "発表日",
    "更新日時",
    "登録日",
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.prefecture ?? "",
    lead.address ?? "",
    lead.industry ?? "",
    getLeadStatusOption(lead.status).label,
    lead.assignee?.name ?? lead.assignee?.email ?? "",
    lead.pressReleaseTitle ?? "",
    lead.videoUrl ?? "",
    lead.productionCompany ?? "",
    lead.pressReleaseUrl ?? "",
    lead.websiteUrl ?? "",
    lead.capital != null ? lead.capital.toString() : "",
    lead.employeeCount != null ? lead.employeeCount.toString() : "",
    lead.announcedDate ? lead.announcedDate.toISOString().split("T")[0] : "",
    lead.updatedAt.toISOString().split("T")[0],
    lead.createdAt.toISOString().split("T")[0],
  ]);

  const csvContent = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell).replace(/"/g, '""');
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s}"`
            : s;
        })
        .join(","),
    )
    .join("\n");

  // BOM付きUTF-8 (Excel互換)
  const bom = "\uFEFF";
  const body = bom + csvContent;

  const now = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tver_pool_claimed_${now}.csv"`,
    },
  });
}
