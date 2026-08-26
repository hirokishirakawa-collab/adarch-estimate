"use server";

// ==============================================================
// LINE公式アカウント × 予約（拠点ごとの予約枠・ホスト・予約一覧）
// ==============================================================

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession, getManageableAccount } from "@/lib/line/access";

type Result = { error?: string; ok?: boolean; message?: string; url?: string };
const BASE = "/dashboard/line";

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string) ?? "").trim();
}
function appBase(): string {
  return (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

/** 予約枠を作成／更新（拠点アカウント専用。本部は /dashboard/admin/bookings で管理） */
export async function saveLineBookingType(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };

  const id = str(fd, "id");
  const title = str(fd, "title").slice(0, 80);
  const description = str(fd, "description").slice(0, 2000) || null;
  const durationMinutes = Math.max(15, Math.min(240, Number(str(fd, "durationMinutes")) || 30));
  const start = str(fd, "start") || "10:00";
  const end = str(fd, "end") || "18:00";
  const days = fd.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
  const maxDaysAhead = Math.max(3, Math.min(60, Number(str(fd, "maxDaysAhead")) || 14));
  const minNoticeHours = Math.max(1, Math.min(168, Number(str(fd, "minNoticeHours")) || 24));
  const isActive = fd.getAll("isActive").includes("on");
  let slug = str(fd, "slug").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  if (!title) return { error: "枠の名前を入れてください" };
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) return { error: "受付時間の指定が不正です" };
  if (days.length === 0) return { error: "受付する曜日を1つ以上選んでください" };

  if (id) {
    const existing = await db.bookingType.findFirst({ where: { id, lineAccountId: accountId } });
    if (!existing) return { error: "枠が見つかりません" };
    await db.bookingType.update({
      where: { id },
      data: { title, description, durationMinutes, businessHours: { days, start, end }, maxDaysAhead, minNoticeHours, isActive },
    });
  } else {
    if (!slug) slug = `line-${crypto.randomBytes(3).toString("hex")}`;
    const dup = await db.bookingType.findUnique({ where: { slug } });
    if (dup) return { error: "同じURL名の枠が既にあります。別のURL名にしてください" };
    // ホスト（担当者本人）を用意して紐付け
    const host = await ensureHostForAccount(accountId, info.email, info.staffName);
    await db.bookingType.create({
      data: {
        slug,
        title,
        description,
        durationMinutes,
        slotStepMinutes: durationMinutes >= 60 ? 30 : durationMinutes,
        bufferMinutes: 15,
        minNoticeHours,
        maxDaysAhead,
        businessHours: { days, start, end },
        questions: [],
        isActive,
        lineAccountId: accountId,
        hosts: { create: [{ hostId: host.id }] },
      },
    });
  }
  revalidatePath(`${BASE}/${accountId}/booking`);
  return { ok: true };
}

async function ensureHostForAccount(accountId: string, email: string, name: string) {
  const existing = await db.bookingHost.findFirst({ where: { lineAccountId: accountId } });
  if (existing) return existing;
  // 同じメールのホストが本部側にあればそれを使う（本部の白川など）
  const byEmail = await db.bookingHost.findUnique({ where: { email: email.toLowerCase() } });
  if (byEmail) return byEmail;
  return db.bookingHost.create({
    data: { name: name || email, email: email.toLowerCase(), priority: 100, lineAccountId: accountId, connectToken: crypto.randomBytes(24).toString("hex") },
  });
}

export async function deleteLineBookingType(accountId: string, id: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const upcoming = await db.booking.count({ where: { bookingTypeId: id, status: "CONFIRMED", startAt: { gte: new Date() } } });
  if (upcoming > 0) return { error: `この枠に今後の予約が${upcoming}件あります。先にキャンセルしてください` };
  await db.bookingType.deleteMany({ where: { id, lineAccountId: accountId } });
  revalidatePath(`${BASE}/${accountId}/booking`);
  return { ok: true };
}

/** Googleカレンダー接続リンクを発行（担当者本人のホスト） */
export async function getLineHostConnectUrl(accountId: string): Promise<Result> {
  const info = await requireSession();
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const host = await ensureHostForAccount(accountId, info.email, info.staffName);
  const token = crypto.randomBytes(24).toString("hex");
  await db.bookingHost.update({ where: { id: host.id }, data: { connectToken: token } });
  revalidatePath(`${BASE}/${accountId}/booking`);
  return { ok: true, url: `${appBase()}/book/connect/${token}` };
}

export async function saveLineBookingReminder(_prev: Result | null, fd: FormData): Promise<Result> {
  const info = await requireSession();
  const accountId = str(fd, "accountId");
  const account = await getManageableAccount(info, accountId);
  if (!account) return { error: "権限がありません" };
  const bookingReminderText = str(fd, "bookingReminderText").slice(0, 2000) || null;
  await db.lineAccount.update({ where: { id: accountId }, data: { bookingReminderText } });
  revalidatePath(`${BASE}/${accountId}/booking`);
  return { ok: true, message: "保存しました" };
}
