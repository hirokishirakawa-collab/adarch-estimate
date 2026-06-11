import { notFound } from "next/navigation";
import { getBookingTypeBySlug, parseQuestions } from "@/lib/booking/service";
import { BookingPageClient } from "@/components/booking/booking-page-client";

export const dynamic = "force-dynamic";

// 公開予約ページ（認証不要）: /book/[slug]
export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,50}$/.test(slug)) notFound();

  const bt = await getBookingTypeBySlug(slug);
  if (!bt || !bt.isActive) notFound();

  return (
    <BookingPageClient
      slug={bt.slug}
      title={bt.title}
      description={bt.description}
      durationMinutes={bt.durationMinutes}
      questions={parseQuestions(bt)}
    />
  );
}
