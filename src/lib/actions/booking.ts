"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordLineBookingCancel } from "@/lib/line/service";
import type { UserRole } from "@/types/roles";
import { deleteCalendarEvent } from "@/lib/booking/google";
import { sendBookingCancelledEmails } from "@/lib/booking/emails";

// ---------------------------------------------------------------
// 商談予約システム — 管理用 Server Actions（ADMIN専用）
// ---------------------------------------------------------------

const ADMIN_PATH = "/dashboard/admin/bookings";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");
  return { callerEmail: session.user.email ?? "" };
}

// ---- ホスト管理 ------------------------------------------------

export async function createBookingHost(input: {
  name: string;
  email: string;
  priority: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "名前とメールアドレスを正しく入力してください" };
  }
  try {
    const host = await db.bookingHost.create({
      data: {
        name,
        email,
        priority: Math.max(1, Math.min(999, Math.floor(input.priority) || 100)),
        connectToken: crypto.randomBytes(24).toString("hex"),
      },
    });
    // 既存の全予約タイプに自動で紐付ける（後からホスト追加しても枠に反映されるように）
    const types = await db.bookingType.findMany({ select: { id: true } });
    if (types.length > 0) {
      await db.bookingTypeHost.createMany({
        data: types.map((t) => ({ bookingTypeId: t.id, hostId: host.id })),
        skipDuplicates: true,
      });
    }
    revalidatePath(ADMIN_PATH);
    return { ok: true };
  } catch (e) {
    console.error("[createBookingHost]", e instanceof Error ? e.message : e);
    return { ok: false, error: "作成に失敗しました（メール重複の可能性）" };
  }
}

export async function updateBookingHost(
  hostId: string,
  input: { priority?: number; isActive?: boolean }
): Promise<{ ok: boolean }> {
  await requireAdmin();
  await db.bookingHost.update({
    where: { id: hostId },
    data: {
      ...(input.priority !== undefined
        ? { priority: Math.max(1, Math.min(999, Math.floor(input.priority))) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

/** 接続招待リンクを再発行（旧リンクは無効化） */
export async function reissueConnectToken(
  hostId: string
): Promise<{ ok: boolean; url?: string }> {
  await requireAdmin();
  const token = crypto.randomBytes(24).toString("hex");
  await db.bookingHost.update({
    where: { id: hostId },
    data: { connectToken: token },
  });
  revalidatePath(ADMIN_PATH);
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return { ok: true, url: `${base}/book/connect/${token}` };
}

// ---- 予約タイプ ------------------------------------------------

/** 加盟面談のデフォルト予約タイプを作成し、全ホストを紐付ける */
export async function ensureFranchiseBookingType(): Promise<{
  ok: boolean;
  slug?: string;
  error?: string;
}> {
  await requireAdmin();
  try {
    const existing = await db.bookingType.findUnique({
      where: { slug: "group" },
    });
    let typeId = existing?.id;
    if (!existing) {
      const created = await db.bookingType.create({
        data: {
          slug: "group",
          title: "加盟に関する個別面談（60分）",
          description:
            "Ad Archグループへの加盟をご検討中の方向けの個別面談です。\n事業内容やご状況を伺いながら、グループの仕組み・展開メニューをご説明します。\nオンライン（Google Meet）で実施します。",
          durationMinutes: 60,
          slotStepMinutes: 30,
          bufferMinutes: 15,
          minNoticeHours: 24,
          maxDaysAhead: 14,
          businessHours: { days: [1, 2, 3, 4, 5], start: "10:00", end: "18:00" },
          questions: [
            {
              id: "business",
              label: "現在の事業内容",
              type: "text",
              required: true,
            },
            {
              id: "self_driven",
              label: "ご自身が現場で動かれる予定ですか",
              type: "select",
              options: ["はい（自分が主体で動く）", "一部任せる予定", "別の担当者が動く"],
              required: true,
            },
            {
              id: "budget",
              label: "新規事業への投資ご予算感",
              type: "select",
              options: ["〜50万円", "50〜100万円", "100万円以上", "未定"],
              required: true,
            },
            {
              id: "background",
              label: "ご検討の背景・聞きたいこと",
              type: "textarea",
              required: false,
            },
          ],
        },
      });
      typeId = created.id;
    }

    // 全ホストを紐付け（既存はスキップ）
    const hosts = await db.bookingHost.findMany({ select: { id: true } });
    for (const h of hosts) {
      await db.bookingTypeHost.upsert({
        where: {
          bookingTypeId_hostId: { bookingTypeId: typeId as string, hostId: h.id },
        },
        create: { bookingTypeId: typeId as string, hostId: h.id },
        update: {},
      });
    }
    revalidatePath(ADMIN_PATH);
    return { ok: true, slug: "group" };
  } catch (e) {
    console.error("[ensureFranchiseBookingType]", e instanceof Error ? e.message : e);
    return { ok: false, error: "作成に失敗しました" };
  }
}

// ---- 予約のキャンセル（管理側から） ----------------------------

export async function cancelBookingByAdmin(
  bookingId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { host: true, bookingType: true },
    });
    if (!booking) return { ok: false, error: "予約が見つかりません" };
    if (booking.status === "CANCELLED") return { ok: true };

    if (booking.googleEventId) {
      await deleteCalendarEvent(booking.host, booking.googleEventId);
    }
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (booking.lineFriendId) {
      recordLineBookingCancel(booking.id).catch((e) => console.error("[book] line cancel record failed", e));
    }
    await sendBookingCancelledEmails({
      bookingTitle: booking.bookingType.title,
      startAt: booking.startAt,
      endAt: booking.endAt,
      applicantName: booking.name,
      applicantCompany: booking.company,
      applicantEmail: booking.email,
      applicantPhone: booking.phone,
      hostName: booking.host.name,
      hostEmail: booking.host.email,
      meetUrl: booking.meetUrl,
      cancelToken: booking.cancelToken,
    });
    revalidatePath(ADMIN_PATH);
    return { ok: true };
  } catch (e) {
    console.error("[cancelBookingByAdmin]", e instanceof Error ? e.message : e);
    return { ok: false, error: "キャンセルに失敗しました" };
  }
}
