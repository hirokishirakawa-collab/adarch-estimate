import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatJst } from "@/lib/booking/slots";
import { CancelBookingClient } from "@/components/booking/cancel-booking-client";

export const dynamic = "force-dynamic";

// 予約キャンセルページ（確認メールのリンクから・認証不要）
export default async function CancelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(token)) notFound();

  const booking = await db.booking.findUnique({
    where: { cancelToken: token },
    include: { bookingType: true },
  });
  if (!booking) notFound();

  return (
    <CancelBookingClient
      token={token}
      title={booking.bookingType.title}
      startLabel={`${formatJst(booking.startAt)} 〜（日本時間）`}
      name={booking.name}
      alreadyCancelled={booking.status === "CANCELLED"}
    />
  );
}
