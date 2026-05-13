import { Film, Inbox, CheckCircle2, ArrowRight, Users, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { TvcmPoolCard, type TvcmPoolLead } from "@/components/leads/tvcm-pool-card";

// 保存直後にプール画面の表示を確実にリフレッシュするため動的レンダリング強制
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TvcmPoolPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });
  if (!user) redirect("/");

  const isAdmin = user.role === "ADMIN";

  // 未claim案件（全パートナーに公開）。SKIPPED（却下済み）は除外
  const unclaimedLeads = (await db.lead.findMany({
    where: {
      source: "PR_TIMES_TVCM",
      assigneeId: null,
      status: { not: "SKIPPED" },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      address: true,
      prefecture: true,
      industry: true,
      pressReleaseUrl: true,
      pressReleaseTitle: true,
      videoUrl: true,
      productionCompany: true,
      announcedDate: true,
      websiteUrl: true,
      scoreComment: true,
      capital: true,
      employeeCount: true,
      createdAt: true,
    },
  })) as TvcmPoolLead[];

  // 自分がclaim済み案件
  const myClaimedLeads = (await db.lead.findMany({
    where: {
      source: "PR_TIMES_TVCM",
      assigneeId: user.id,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      address: true,
      prefecture: true,
      industry: true,
      pressReleaseUrl: true,
      pressReleaseTitle: true,
      videoUrl: true,
      productionCompany: true,
      announcedDate: true,
      websiteUrl: true,
      scoreComment: true,
      capital: true,
      employeeCount: true,
      createdAt: true,
    },
  })) as TvcmPoolLead[];

  // ADMIN向け: パートナーごとのclaim状況集計
  type PartnerStat = {
    userId: string;
    name: string;
    email: string;
    total: number;
    statusCounts: Record<string, number>;
    lastClaimedAt: Date;
  };
  let partnerStats: PartnerStat[] = [];
  if (isAdmin) {
    const claimedLeads = await db.lead.findMany({
      where: {
        source: "PR_TIMES_TVCM",
        assigneeId: { not: null },
      },
      select: {
        assigneeId: true,
        status: true,
        updatedAt: true,
        assignee: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const statMap = new Map<string, PartnerStat>();
    for (const lead of claimedLeads) {
      if (!lead.assigneeId) continue;
      const existing = statMap.get(lead.assigneeId);
      if (existing) {
        existing.total++;
        existing.statusCounts[lead.status] = (existing.statusCounts[lead.status] ?? 0) + 1;
        if (lead.updatedAt > existing.lastClaimedAt) {
          existing.lastClaimedAt = lead.updatedAt;
        }
      } else {
        statMap.set(lead.assigneeId, {
          userId: lead.assigneeId,
          name: lead.assignee?.name ?? lead.assignee?.email ?? "（不明）",
          email: lead.assignee?.email ?? "",
          total: 1,
          statusCounts: { [lead.status]: 1 },
          lastClaimedAt: lead.updatedAt,
        });
      }
    }
    partnerStats = Array.from(statMap.values()).sort((a, b) => b.total - a.total);
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
            <Film className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              TVer広告 案件プール
            </h2>
            <p className="text-xs text-zinc-500">
              本部が抽出した動画コンテンツ発表企業のリスト。「私がやります」で先着順に担当を確保
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/dashboard/leads/tvcm"
              className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-rose-200"
            >
              プールに追加（クロール）
            </Link>
          )}
          <Link
            href="/dashboard/leads/list"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            リード管理へ <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 使い方 */}
      <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
        <p className="text-xs font-semibold text-zinc-700 mb-3">使い方</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px]">
          <div>
            <p className="text-xs font-medium text-zinc-800">1. プールを見る</p>
            <p className="text-zinc-500 mt-0.5">
              本部が抽出した、新CM・ブランドムービー・サービス紹介動画 発表企業のリストを確認
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">2. 「私がやります」</p>
            <p className="text-zinc-500 mt-0.5">
              気になる案件を先着でclaim。他パートナーは取れなくなります
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-800">3. リード管理で営業</p>
            <p className="text-zinc-500 mt-0.5">
              「動画があるならTVerで流しませんか？」の切り口で営業開始
            </p>
          </div>
        </div>
      </div>

      {/* ADMIN向け: パートナー別claim状況 */}
      {isAdmin && partnerStats.length > 0 && (
        <section className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900">
                パートナー別claim状況（本部のみ・TVer広告案件）
              </h3>
              <span className="text-[10px] font-medium text-blue-700 bg-white border border-blue-200 px-1.5 py-0.5 rounded">
                {partnerStats.length}名がclaim
              </span>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-5 py-2 font-medium text-zinc-600">パートナー</th>
                <th className="text-center px-2 py-2 font-medium text-zinc-600">claim数</th>
                <th className="text-center px-2 py-2 font-medium text-zinc-600">未着手</th>
                <th className="text-center px-2 py-2 font-medium text-zinc-600">架電済</th>
                <th className="text-center px-2 py-2 font-medium text-zinc-600">アポ</th>
                <th className="text-center px-2 py-2 font-medium text-zinc-600">受注</th>
                <th className="text-center px-2 py-2 font-medium text-zinc-600">却下</th>
                <th className="text-right px-5 py-2 font-medium text-zinc-600">直近claim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {partnerStats.map((stat) => (
                <tr key={stat.userId} className="hover:bg-zinc-50">
                  <td className="px-5 py-2 font-medium text-zinc-900">{stat.name}</td>
                  <td className="text-center px-2 py-2">
                    <span className="inline-flex items-center gap-0.5 font-bold text-zinc-900">
                      <TrendingUp className="w-3 h-3 text-emerald-600" />
                      {stat.total}
                    </span>
                  </td>
                  <td className="text-center px-2 py-2 text-zinc-500">{stat.statusCounts.UNTOUCHED ?? 0}</td>
                  <td className="text-center px-2 py-2 text-blue-600">{stat.statusCounts.CALLED ?? 0}</td>
                  <td className="text-center px-2 py-2 text-amber-600 font-semibold">{stat.statusCounts.APPOINTMENT ?? 0}</td>
                  <td className="text-center px-2 py-2 text-emerald-600 font-bold">{stat.statusCounts.DEAL_CONVERTED ?? 0}</td>
                  <td className="text-center px-2 py-2 text-zinc-400">{stat.statusCounts.SKIPPED ?? 0}</td>
                  <td className="text-right px-5 py-2 text-[11px] text-zinc-500">
                    {stat.lastClaimedAt.toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 自分のclaim済み（先頭に表示） */}
      {myClaimedLeads.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-zinc-900">
              あなたが担当中の案件
            </h3>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              {myClaimedLeads.length}件
            </span>
          </div>
          <div className="space-y-2">
            {myClaimedLeads.map((lead) => (
              <TvcmPoolCard key={lead.id} lead={lead} claimable={false} />
            ))}
          </div>
        </section>
      )}

      {/* 未claim プール */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-semibold text-zinc-900">未claim案件プール（TVer広告営業）</h3>
          <span className="text-[10px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
            {unclaimedLeads.length}件
          </span>
          <span className="text-[10px] text-zinc-500 ml-2">先着順</span>
        </div>

        {unclaimedLeads.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center">
            <Inbox className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">
              現在、未claimのTVer広告案件はありません。
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              本部がプールに新規追加するまでお待ちください。
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {unclaimedLeads.map((lead) => (
              <TvcmPoolCard key={lead.id} lead={lead} claimable={true} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
