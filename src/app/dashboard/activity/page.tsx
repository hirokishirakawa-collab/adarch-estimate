import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ActivityKpiBar } from "@/components/dashboard/activity-kpi-bar";
import { getActivityKpi } from "@/lib/kpis/activity";
import { MySalesPanel } from "@/components/dashboard/my-sales-panel";
import { AnniversaryCard } from "@/components/dashboard/anniversary-card";
import { getOrGenerateDigest } from "@/lib/digest";
import { SalesBoost } from "@/components/dashboard/sales-boost";
import { AiWorkButton } from "@/components/workspace/ai-work-button";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const kpi = await getActivityKpi();
  return (
    <div className="os-page">
      <div className="os-page-head">
        <div>
          <h1>活動を振り返る</h1>
          <p className="os-description">
            グループの活動と、自分の営業の積み重ね。
          </p>
        </div>
        <AiWorkButton />
      </div>
      <div className="space-y-6">
        <Suspense>
          <GroupDigest />
        </Suspense>
        <ActivityKpiBar kpi={kpi} />
        <Suspense fallback={<p>営業の状況を確認しています…</p>}>
          <MySalesPanel showLink />
        </Suspense>
        <Suspense>
          <AnniversaryCard userEmail={session.user.email} />
        </Suspense>
        {session.user.email && (
          <Suspense>
            <SalesBoost userEmail={session.user.email} />
          </Suspense>
        )}
      </div>
      <div className="os-home-links">
        <Link href="/dashboard/sales-insights">営業の分析 →</Link>
        <Link href="/dashboard/live">GROUP LIVE →</Link>
        <Link href="/dashboard/next-actions">今日の一手 →</Link>
        <Link href="/dashboard/portfolio">グループ実績 →</Link>
      </div>
    </div>
  );
}

async function GroupDigest() {
  const digest = await getOrGenerateDigest();
  return (
    <section className="os-notice">
      <h2>グループダイジェスト</h2>
      {digest ? (
        <>
          <p className="whitespace-pre-line mt-3">{digest.content}</p>
          <p className="os-footnote">
            更新{" "}
            {digest.updatedAt.toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            })}
          </p>
        </>
      ) : (
        <p>
          ダイジェストを取得できませんでした。時間をおいて再度ご確認ください。
        </p>
      )}
    </section>
  );
}
