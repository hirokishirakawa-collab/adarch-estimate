"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidVideoUrl } from "@/lib/seminars/video";

async function me() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const u = await db.user.findUnique({
    where: { email },
    select: { email: true, name: true, role: true, groupCompanyId: true, groupCompany: { select: { name: true, prefecture: true } } },
  });
  return u;
}

/** 録画を登録（登録した瞬間からグループ全社が使える） */
export async function createRecording(formData: FormData): Promise<void> {
  const u = await me();
  if (!u) return;
  const title = String(formData.get("title") ?? "").trim();
  const videoUrl = String(formData.get("videoUrl") ?? "").trim();
  const presenterName = String(formData.get("presenterName") ?? "").trim() || (u.name ?? u.email);
  const audience = String(formData.get("audience") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const durationRaw = String(formData.get("durationMin") ?? "").trim();
  const recordedRaw = String(formData.get("recordedAt") ?? "").trim();
  if (!title || !isValidVideoUrl(videoUrl)) return;
  await db.seminarRecording.create({
    data: {
      title,
      videoUrl,
      presenterName,
      ownerEmail: u.email,
      ownerCompanyId: u.groupCompanyId,
      ownerCompany: u.groupCompany?.name ?? "Ad Arch本部",
      prefecture: u.groupCompany?.prefecture ?? null,
      audience,
      summary: summary ? summary.slice(0, 600) : null,
      durationMin: durationRaw ? Number.parseInt(durationRaw, 10) || null : null,
      recordedAt: recordedRaw ? new Date(recordedRaw) : null,
    },
  });
  revalidatePath("/dashboard/seminars");
}

/** 自分の録画を取り下げる（本部は全件可）。公開ページは404になる */
export async function deactivateRecording(formData: FormData): Promise<void> {
  const u = await me();
  if (!u) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const r = await db.seminarRecording.findUnique({ where: { id }, select: { ownerEmail: true } });
  if (!r) return;
  if (r.ownerEmail !== u.email && u.role !== "ADMIN") return;
  await db.seminarRecording.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/dashboard/seminars");
}
