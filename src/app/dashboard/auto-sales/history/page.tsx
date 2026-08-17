import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SentHistory } from "./SentHistory";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

/**
 * 全社共有の送付履歴。
 * どの拠点がどの会社へ送ったかを全員が見られる。二重送信を防ぐための共有台帳でもある。
 * 送信本文とスクリーンショットは自拠点分と本部のみ（モニター画面）で、ここには出さない。
 */
export default async function AutoSalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { branch: { select: { name: true } } },
  });
  if (!user) redirect("/");

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && !user.enabledFeatures.includes("auto-sales")) {
    redirect("/dashboard");
  }

  const where = query
    ? {
        OR: [
          { companyName: { contains: query, mode: "insensitive" as const } },
          { domain: { contains: query.toLowerCase() } },
        ],
      }
    : {};

  const [rows, total, responded] = await Promise.all([
    db.autoSalesSentDomain.findMany({
      where,
      include: { branch: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.autoSalesSentDomain.count({ where }),
    db.autoSalesSentDomain.count({ where: { ...where, hasResponse: true } }),
  ]);

  return (
    <SentHistory
      rows={JSON.parse(JSON.stringify(rows))}
      total={total}
      responded={responded}
      page={page}
      pageSize={PAGE_SIZE}
      query={query}
      myBranchName={user.branch?.name ?? "本部"}
    />
  );
}
