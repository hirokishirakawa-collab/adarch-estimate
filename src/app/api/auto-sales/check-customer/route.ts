import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * 自動営業ターゲット登録前に既存顧客との重複をチェックする
 * クエリ: ?companyName=xxx&phone=xxx&url=xxx
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user?.branchId) {
    return NextResponse.json({ error: "Branch not assigned" }, { status: 400 });
  }

  const companyName = req.nextUrl.searchParams.get("companyName")?.trim();
  const phone = req.nextUrl.searchParams.get("phone")?.trim();
  const url = req.nextUrl.searchParams.get("url")?.trim();

  if (!companyName && !phone && !url) {
    return NextResponse.json({ matches: [] });
  }

  // 検索条件を構築
  const conditions: Array<Record<string, unknown>> = [];

  // 1. 会社名: 部分一致（正規化: スペース除去）
  if (companyName && companyName.length >= 2) {
    conditions.push({
      name: { contains: companyName, mode: "insensitive" },
    });
  }

  // 2. 電話番号: ハイフン除去して一致
  if (phone) {
    const normalizedPhone = phone.replace(/[-\s()（）]/g, "");
    if (normalizedPhone.length >= 4) {
      conditions.push({
        phone: { contains: normalizedPhone.slice(-4) },
      });
    }
  }

  // 3. ドメイン: URLのドメインで website を検索
  if (url) {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      conditions.push({
        website: { contains: domain, mode: "insensitive" },
      });
    } catch {
      // invalid URL — skip
    }
  }

  if (conditions.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const customers = await db.customer.findMany({
    where: {
      OR: conditions,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      website: true,
      status: true,
      rank: true,
      branch: { select: { name: true } },
    },
    take: 10,
  });

  // 電話番号の正規化後の再フィルタ（DBが部分一致なので精度を上げる）
  const normalizedInputPhone = phone?.replace(/[-\s()（）]/g, "") ?? "";
  const matches = customers.map((c) => {
    const matchReasons: string[] = [];
    if (
      companyName &&
      c.name.toLowerCase().includes(companyName.toLowerCase())
    ) {
      matchReasons.push("会社名");
    }
    if (normalizedInputPhone && c.phone) {
      const cPhone = c.phone.replace(/[-\s()（）]/g, "");
      if (cPhone === normalizedInputPhone || cPhone.endsWith(normalizedInputPhone.slice(-4))) {
        matchReasons.push("電話番号");
      }
    }
    if (url && c.website) {
      try {
        const inputDomain = new URL(url).hostname.replace(/^www\./, "");
        if (c.website.toLowerCase().includes(inputDomain)) {
          matchReasons.push("ドメイン");
        }
      } catch {
        // skip
      }
    }
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      website: c.website,
      status: c.status,
      rank: c.rank,
      branchName: c.branch?.name ?? null,
      matchReasons,
    };
  }).filter((m) => m.matchReasons.length > 0);

  return NextResponse.json({ matches });
}
