// POST /api/dm/prepare — 画面版の郵送DM（AI連携 prepare_dm と同じ実装・同じ記録）
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { WriteError } from "@/lib/mcp/os-write-tools";
import { prepareDm, type PrepareDmInput } from "@/lib/dm/prepare-dm";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = await loadViewer(session.user.email);
  if (!viewer) return NextResponse.json({ error: "このアカウントは利用できません" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as PrepareDmInput | null;
  if (!body) return NextResponse.json({ error: "入力を読めませんでした" }, { status: 400 });
  try {
    const result = await prepareDm(viewer, body);
    void logAudit({ action: "dm_prepare", email: viewer.email, name: viewer.name, entity: "lead", detail: `[画面] ${body.prefecture} ${body.city} ${result.counts.ready}件`.slice(0, 300) });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof WriteError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[dm/prepare]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "DMの材料を作れませんでした" }, { status: 500 });
  }
}
