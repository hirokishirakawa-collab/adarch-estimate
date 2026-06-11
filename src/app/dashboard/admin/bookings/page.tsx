import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";
import { BookingAdminClient } from "@/components/admin/booking-admin-client";

export const dynamic = "force-dynamic";

// 面談予約管理（ADMIN専用）: ホスト接続状況・予約一覧・予約ページ発行
export default async function AdminBookingsPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const [hosts, bookingTypes, bookings] = await Promise.all([
    db.bookingHost.findMany({ orderBy: { priority: "asc" } }),
    db.bookingType.findMany({ orderBy: { createdAt: "asc" } }),
    db.booking.findMany({
      orderBy: { startAt: "desc" },
      take: 100,
      include: {
        host: { select: { name: true } },
        bookingType: { select: { title: true } },
      },
    }),
  ]);

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900">面談予約管理</h1>
          <p className="text-sm text-zinc-500">
            予約ページの公開・ホストのカレンダー接続・予約状況を管理します
          </p>
        </div>
      </div>

      <BookingAdminClient
        appBase={appBase}
        hosts={hosts.map((h) => ({
          id: h.id,
          name: h.name,
          email: h.email,
          priority: h.priority,
          isActive: h.isActive,
          connected: Boolean(h.googleRefreshToken),
          googleEmail: h.googleEmail,
          connectToken: h.connectToken,
        }))}
        bookingTypes={bookingTypes.map((t) => ({
          slug: t.slug,
          title: t.title,
          isActive: t.isActive,
        }))}
        bookings={bookings.map((b) => ({
          id: b.id,
          startAt: b.startAt.toISOString(),
          status: b.status,
          name: b.name,
          company: b.company,
          email: b.email,
          phone: b.phone,
          hostName: b.host.name,
          typeTitle: b.bookingType.title,
          meetUrl: b.meetUrl,
          answers: Array.isArray(b.answers)
            ? (b.answers as { label: string; value: string }[])
            : [],
        }))}
      />
    </div>
  );
}
