import { Film, ArrowRight, Database, Inbox, PhoneCall, Calendar, Trophy, XCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { TvcmHistoryCard, type TvcmHistoryLead } from "@/components/leads/tvcm-history-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatusFilter = "all" | "CRAWLED" | "UNTOUCHED" | "ACTIVE" | "DEAL_CONVERTED" | "SKIPPED";

interface SearchParams {
  searchParams?: Promise<{ status?: string }>;
}

export default async function TvcmHistoryPage({ searchParams }: SearchParams) {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/dashboard/leads/tvcm-pool");

  const params = await searchParams;
  const filter = (params?.status ?? "all") as StatusFilter;

  // 全TVCMリード取得 + 件数集計
  const allLeads = await db.lead.findMany({
    where: { source: "PR_TIMES_TVCM" },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      name: true,
      address: true,
      prefecture: true,
      industry: true,
      status: true,
      pressReleaseUrl: true,
      videoUrl: true,
      productionCompany: true,
      announcedDate: true,
      websiteUrl: true,
      scoreComment: true,
      agencyDetected: true,
      isListed: true,
      capital: true,
      employeeCount: true,
      createdAt: true,
      assignee: { select: { name: true, email: true } },
    },
  });

  // ステータス別件数
  const counts = {
    all: allLeads.length,
    CRAWLED: 0,
    UNTOUCHED: 0,
    ACTIVE: 0, // CALLED + APPOINTMENT
    DEAL_CONVERTED: 0,
    SKIPPED: 0,
  };
  for (const l of allLeads) {
    if (l.status === "CRAWLED") counts.CRAWLED++;
    else if (l.status === "UNTOUCHED") counts.UNTOUCHED++;
    else if (l.status === "CALLED" || l.status === "APPOINTMENT") counts.ACTIVE++;
    else if (l.status === "DEAL_CONVERTED") counts.DEAL_CONVERTED++;
    else if (l.status === "SKIPPED") counts.SKIPPED++;
  }

  // フィルタ適用
  const filtered = allLeads.filter((l) => {
    if (filter === "all") return true;
    if (filter === "ACTIVE") return l.status === "CALLED" || l.status === "APPOINTMENT";
    return l.status === filter;
  });

  const leads: TvcmHistoryLead[] = filtered.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    prefecture: l.prefecture,
    industry: l.industry,
    status: l.status,
    pressReleaseUrl: l.pressReleaseUrl,
    videoUrl: l.videoUrl,
    productionCompany: l.productionCompany,
    announcedDate: l.announcedDate,
    websiteUrl: l.websiteUrl,
    scoreComment: l.scoreComment,
    agencyDetected: l.agencyDetected,
    isListed: l.isListed,
    capital: l.capital,
    employeeCount: l.employeeCount,
    createdAt: l.createdAt,
    assigneeName: l.assignee?.name ?? l.assignee?.email ?? null,
  }));

  const tabs: { value: StatusFilter; label: string; icon: typeof Database; count: number; color: string }[] = [
    { value: "all", label: "すべて", icon: Database, count: counts.all, color: "zinc" },
    { value: "CRAWLED", label: "未判定", icon: Database, count: counts.CRAWLED, color: "zinc" },
    { value: "UNTOUCHED", label: "プール中", icon: Inbox, count: counts.UNTOUCHED, color: "blue" },
    { value: "ACTIVE", label: "営業中", icon: PhoneCall, count: counts.ACTIVE, color: "violet" },
    { value: "DEAL_CONVERTED", label: "受注", icon: Trophy, count: counts.DEAL_CONVERTED, color: "emerald" },
    { value: "SKIPPED", label: "却下", icon: XCircle, count: counts.SKIPPED, color: "red" },
  ];

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
            <Database className="w-4 h-4 text-zinc-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">TVer広告 案件 クロール履歴</h2>
            <p className="text-xs text-zinc-500">
              全クロール候補をデータ保全。後からプール投入・却下を判断できます（本部のみ）
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/leads/tvcm"
            className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-rose-200"
          >
            <Film className="w-3 h-3" />
            新規クロール
          </Link>
          <Link
            href="/dashboard/leads/tvcm-pool"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            プール画面へ <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* フィルタータブ */}
      <div className="bg-white rounded-xl border border-zinc-200 p-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const active = filter === t.value;
            const Icon = t.icon;
            return (
              <Link
                key={t.value}
                href={`/dashboard/leads/tvcm-history${t.value === "all" ? "" : `?status=${t.value}`}`}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  active
                    ? `bg-${t.color}-600 text-white border-${t.color}-600`
                    : `bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300`
                }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
                <span
                  className={`text-[10px] font-bold ${
                    active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                  } px-1.5 py-0.5 rounded`}
                >
                  {t.count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* リード一覧 */}
      {leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center">
          <Database className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">該当するTVer広告案件リードがありません。</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            クロール画面から新規取得してください。
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <TvcmHistoryCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
