"use server";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// ---------------------------------------------------------------
// GET /api/leads/import/template
// CSVインポート用テンプレートをダウンロード
// ---------------------------------------------------------------
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers = "会社名,住所,電話番号,WebサイトURL,業種,エリア,メモ,担当者名";

  // BOM付きUTF-8 (Excel互換)
  const bom = "\uFEFF";
  const body = bom + headers + "\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="lead_import_template.csv"',
    },
  });
}
