import Link from "next/link";
import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { BookingManager } from "@/components/line/booking-manager";
import { bookingTypeScope } from "@/lib/line/service";
import { fmtJst } from "@/lib/line/format";

export const dynamic = "force-dynamic";

export default async function LineBookingPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { info, account } = await loadAccountPage(accountId);
  const isHq = account.branchId === null;
  const now = new Date();
  const scope = await bookingTypeScope(accountId);
  const [types, host, friends] = await Promise.all([
    db.bookingType.findMany({
      where: scope,
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { bookings: { where: { status: "CONFIRMED", startAt: { gte: now } } } } } },
    }),
    db.bookingHost.findFirst({ where: { OR: [{ lineAccountId: accountId }, { email: info.email.toLowerCase() }] }, select: { name: true, email: true, connectedAt: true } }),
    db.lineFriend.findMany({ where: { accountId }, select: { id: true, displayName: true } }),
  ]);
  const friendIds = friends.map((f) => f.id);
  const friendName = new Map(friends.map((f) => [f.id, f.displayName ?? "（名前未取得）"]));
  const bookings = friendIds.length
    ? await db.booking.findMany({
        where: { lineFriendId: { in: friendIds } },
        orderBy: { startAt: "desc" },
        take: 50,
        include: { bookingType: { select: { title: true } } },
      })
    : [];

  const typeDefs = types.map((t) => {
    const bh = (t.businessHours ?? {}) as { days?: number[]; start?: string; end?: string };
    return {
      id: t.id, slug: t.slug, title: t.title, description: t.description, durationMinutes: t.durationMinutes,
      days: bh.days ?? [1, 2, 3, 4, 5], start: bh.start ?? "10:00", end: bh.end ?? "18:00",
      maxDaysAhead: t.maxDaysAhead, minNoticeHours: t.minNoticeHours, isActive: t.isActive,
      own: t.lineAccountId === accountId, upcoming: t._count.bookings,
    };
  });

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <BookingManager
        accountId={accountId}
        isHq={isHq}
        types={typeDefs}
        host={host ? { name: host.name, email: host.email, connected: !!host.connectedAt } : null}
        reminderText={account.bookingReminderText}
      />

      <section className="space-y-2">
        <p className="text-xs font-bold text-zinc-500">LINEの友だちからの予約</p>
        {bookings.length === 0 ? (
          <p className="text-xs text-zinc-400">まだ予約はありません。</p>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">日時</th>
                  <th className="text-left px-3 py-2 font-medium">枠</th>
                  <th className="text-left px-3 py-2 font-medium">友だち</th>
                  <th className="text-left px-3 py-2 font-medium">申込者</th>
                  <th className="text-left px-3 py-2 font-medium">状態</th>
                  <th className="text-left px-3 py-2 font-medium">Meet</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtJst(b.startAt)}</td>
                    <td className="px-3 py-2">{b.bookingType.title}</td>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/line/${accountId}/chat/${b.lineFriendId}`} className="text-emerald-700 underline">{friendName.get(b.lineFriendId ?? "") ?? "—"}</Link>
                    </td>
                    <td className="px-3 py-2">{b.name}{b.company ? `（${b.company}）` : ""}</td>
                    <td className="px-3 py-2">{b.status === "CONFIRMED" ? "確定" : "キャンセル"}{b.reminderSentAt ? " ・ リマインド済" : ""}</td>
                    <td className="px-3 py-2">{b.meetUrl ? <a href={b.meetUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">開く</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
