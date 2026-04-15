import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyMobileToken } from "../_lib/verify-mobile-token";
import { resolveDbUser } from "../_lib/authorize";
import type { LeadSource } from "@/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const limitParam = searchParams.get("limit");
  const sourceParam = searchParams.get("source");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 50;

  const validSources: LeadSource[] = [
    "GOOGLE_PLACES",
    "GBIZINFO",
    "CINEMA_AD",
    "MANUAL",
    "SIGNBOARD_SCAN",
  ];
  const sourceFilter =
    sourceParam && validSources.includes(sourceParam as LeadSource)
      ? (sourceParam as LeadSource)
      : undefined;

  try {
    // Non-ADMIN: only leads the user created or is assigned to
    let ownerFilter: Record<string, unknown> = {};
    if (user.role !== "ADMIN") {
      const dbUser = await resolveDbUser(user.email);
      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 403 });
      }
      ownerFilter = {
        OR: [{ createdById: dbUser.id }, { assigneeId: dbUser.id }],
      };
    }

    const where = {
      ...ownerFilter,
      ...(sourceFilter ? { source: sourceFilter } : {}),
    };

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        industry: true,
        area: true,
        scoreTotal: true,
        source: true,
        status: true,
        address: true,
        phone: true,
        websiteUrl: true,
        createdAt: true,
      },
    });

    const result = leads.map((l) => ({
      id: l.id,
      companyName: l.name,
      industry: l.industry ?? null,
      area: l.area ?? null,
      score: l.scoreTotal,
      source: l.source,
      status: l.status,
      address: l.address ?? null,
      phone: l.phone ?? null,
      websiteUrl: l.websiteUrl ?? null,
      createdAt: l.createdAt,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/mobile/leads]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    companyName?: string;
    industry?: string;
    address?: string;
    phone?: string;
    website?: string;
    score?: number;
    source?: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }

  const validSources: LeadSource[] = [
    "GOOGLE_PLACES",
    "GBIZINFO",
    "CINEMA_AD",
    "MANUAL",
    "SIGNBOARD_SCAN",
  ];
  const source: LeadSource =
    body.source && validSources.includes(body.source as LeadSource)
      ? (body.source as LeadSource)
      : "SIGNBOARD_SCAN";

  try {
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    const lead = await db.lead.create({
      data: {
        name: body.companyName.trim(),
        industry: body.industry?.trim() || null,
        address: body.address?.trim() || null,
        phone: body.phone?.trim() || null,
        websiteUrl: body.website?.trim() || null,
        scoreTotal: typeof body.score === "number" ? body.score : 0,
        memo: body.notes?.trim() || null,
        source,
        createdById: dbUser?.id ?? null,
        assigneeId: dbUser?.id ?? null,
      },
      select: {
        id: true,
        name: true,
        industry: true,
        area: true,
        scoreTotal: true,
        source: true,
        status: true,
        address: true,
        phone: true,
        websiteUrl: true,
        createdAt: true,
      },
    });

    await db.leadLog.create({
      data: {
        leadId: lead.id,
        action: "CREATED",
        detail: `モバイルアプリから保存（ソース: ${source}、スコア: ${lead.scoreTotal}）`,
        staffName: user.name ?? user.email,
      },
    });

    return NextResponse.json(
      {
        id: lead.id,
        companyName: lead.name,
        industry: lead.industry ?? null,
        area: lead.area ?? null,
        score: lead.scoreTotal,
        source: lead.source,
        status: lead.status,
        address: lead.address ?? null,
        phone: lead.phone ?? null,
        websiteUrl: lead.websiteUrl ?? null,
        createdAt: lead.createdAt,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[POST /api/mobile/leads]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
