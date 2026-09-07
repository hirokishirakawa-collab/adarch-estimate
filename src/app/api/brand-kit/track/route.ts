import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trackBrandKit, type BrandKitEvent, type BrandKitKind } from "@/lib/brand-kit/track";

const EVENTS: BrandKitEvent[] = ["download", "copy"];
const KINDS: BrandKitKind[] = ["material", "combined", "zip", "copy_one", "copy_all"];

// ブラウザ内で完結する操作（全文コピー・1本のmd・ZIP・共通の決まりmd）の記録を受ける（ログイン必須）
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { event?: unknown; kind?: unknown; items?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const event = EVENTS.find((e) => e === body.event);
  const kind = KINDS.find((k) => k === body.kind);
  const items = Array.isArray(body.items) ? body.items.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 80)) : [];
  if (!event || !kind) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  trackBrandKit({ event, kind, items, email: session.user.email, name: session.user.name ?? null, req });
  return NextResponse.json({ ok: true });
}
