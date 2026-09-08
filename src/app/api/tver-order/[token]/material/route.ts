import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyCeo } from "@/lib/google-chat";
import { uploadTverOrderMaterial } from "@/lib/storage";
import { orderNumberLabel } from "@/lib/tver-order/plans";
import { appUrl } from "@/lib/tver-order/service";

export const runtime = "nodejs";
const MAX_BYTES = 300 * 1024 * 1024; // 15秒動画（ProRes でも収まる上限）
const ALLOWED = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"]);

// POST /api/tver-order/[token]/material  multipart(file, note) → 保存して受領にする
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const o = await db.tverOrder.findUnique({ where: { token }, select: { id: true, status: true, number: true, createdAt: true, advertiserName: true, paidAt: true } });
  if (!o || !o.paidAt) return NextResponse.json({ error: "決済が完了していません" }, { status: 403 });
  if (!["PAID", "REVIEWING", "MATERIAL_WAITING", "MATERIAL_RECEIVED"].includes(o.status)) return NextResponse.json({ error: "この申込は動画を受け付けていません" }, { status: 400 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "ファイルを読み取れませんでした" }, { status: 400 }); }
  const file = form.get("file");
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "動画ファイルを選んでください" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "300MBまでのファイルにしてください（大きい場合はURL共有をご利用ください）" }, { status: 413 });
  if (file.type && !ALLOWED.has(file.type)) return NextResponse.json({ error: "mp4 / mov / webm の動画ファイルにしてください" }, { status: 415 });

  const path = await uploadTverOrderMaterial(file);
  if (!path) return NextResponse.json({ error: "保存に失敗しました。URL共有をお試しください" }, { status: 500 });
  const url = `${appUrl()}${path}`;
  const next = o.status === "MATERIAL_WAITING" ? "MATERIAL_RECEIVED" : o.status;
  await db.tverOrder.update({ where: { id: o.id }, data: { materialUrl: url, materialNote: [file.name, note].filter(Boolean).join(" / ") || null, status: next } });
  const no = orderNumberLabel(o.number, o.createdAt);
  logAudit({ action: "tver_order_material_uploaded", email: "form@order", name: o.advertiserName, entity: "tver_order", entityId: o.id, detail: `${no} ${file.name} ${(file.size / 1024 / 1024).toFixed(1)}MB` });
  notifyCeo(`🎬 *TVer小口申込 動画アップロード* ${no} ${o.advertiserName}\n${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB）${note ? `\n${note}` : ""}\n👉 ${appUrl()}/dashboard/admin/tver-orders/${o.id}`).catch(() => {});
  return NextResponse.json({ ok: true, url });
}
