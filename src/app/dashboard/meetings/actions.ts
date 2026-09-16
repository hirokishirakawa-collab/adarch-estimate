"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MeetingVisibility } from "@/generated/prisma/client";
import { canReadFull, MEETING_SOURCE_OPTIONS, MEETING_VISIBILITY_OPTIONS } from "@/lib/meetings/notes";

// 会議メモの作成・更新。守秘の面なので、書き込み側でも必ず本人・本部・指名を確かめる。

async function me() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return db.user.findUnique({
    where: { email },
    select: { email: true, name: true, role: true, branchId: true },
  });
}

const lines = (v: FormDataEntryValue | null, max = 12) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.replace(/^[・\-*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, max);

const emails = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
    .slice(0, 30);

export async function createMeetingNote(formData: FormData): Promise<void> {
  const u = await me();
  if (!u) return;

  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!title || !summary) return;

  const source = String(formData.get("source") ?? "ZOOM");
  const visibility = String(formData.get("visibility") ?? "PRIVATE") as MeetingVisibility;
  const meetingAtRaw = String(formData.get("meetingAt") ?? "").trim();
  const durationRaw = String(formData.get("durationMin") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim() || null;

  const note = await db.meetingNote.create({
    data: {
      title: title.slice(0, 200),
      meetingAt: meetingAtRaw ? new Date(meetingAtRaw) : new Date(),
      durationMin: durationRaw ? Number.parseInt(durationRaw, 10) || null : null,
      source: MEETING_SOURCE_OPTIONS.some((o) => o.value === source) ? source : "OTHER",
      customerId,
      branchId: u.branchId,
      counterpart: String(formData.get("counterpart") ?? "").trim().slice(0, 200) || null,
      industry: String(formData.get("industry") ?? "").trim().slice(0, 60) || null,
      prefecture: String(formData.get("prefecture") ?? "").trim().slice(0, 20) || null,
      summary: summary.slice(0, 8000),
      concerns: lines(formData.get("concerns")),
      winPoints: lines(formData.get("winPoints")),
      objections: lines(formData.get("objections")),
      nextActions: lines(formData.get("nextActions")),
      sharedSummary: String(formData.get("sharedSummary") ?? "").trim().slice(0, 3000) || null,
      visibility: MEETING_VISIBILITY_OPTIONS.some((o) => o.value === visibility) ? visibility : "PRIVATE",
      allowedEmails: emails(formData.get("allowedEmails")),
      createdByEmail: u.email,
      createdByName: u.name ?? u.email,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/meetings");
  redirect(`/dashboard/meetings/${note.id}`);
}

/** 公開範囲と指名だけを直す（原文を開ける人のみ） */
export async function updateMeetingAccess(formData: FormData): Promise<void> {
  const u = await me();
  if (!u) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const note = await db.meetingNote.findUnique({ where: { id }, select: { createdByEmail: true, allowedEmails: true } });
  if (!note) return;
  // ページ側と同じ判定をここでも通す（画面を経由しない呼び出しを防ぐ）
  if (!canReadFull({ email: u.email, role: u.role as "ADMIN" | "MANAGER" | "USER" }, note)) return;

  const visibility = String(formData.get("visibility") ?? "PRIVATE") as MeetingVisibility;
  await db.meetingNote.update({
    where: { id },
    data: {
      visibility: MEETING_VISIBILITY_OPTIONS.some((o) => o.value === visibility) ? visibility : "PRIVATE",
      allowedEmails: emails(formData.get("allowedEmails")),
    },
  });
  revalidatePath(`/dashboard/meetings/${id}`);
  revalidatePath("/dashboard/meetings");
}
