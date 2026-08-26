import { notFound } from "next/navigation";
import { getBookingTypeBySlug, parseQuestions } from "@/lib/booking/service";
import { BookingPageClient } from "@/components/booking/booking-page-client";

export const dynamic = "force-dynamic";

// 公開予約ページ（認証不要）: /book/[slug]
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const lineToken = typeof t === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(t) ? t : null;
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
      lineToken={lineToken}
    />
  );
}
