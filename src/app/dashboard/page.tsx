import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { LiveBoard } from "@/components/live/live-board";
import { NextActions } from "@/components/workspace/next-actions";
import { PersonalInbox } from "@/components/workspace/personal-inbox";
import { HomeHeading } from "@/components/workspace/work-connection";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="os-page os-connected-home">
      <HomeHeading />
      {session.user.email !== "demo@adarch.co.jp" &&
        session.user.isActive !== false && (
          <div data-tour="group-live">
            <LiveBoard compact />
          </div>
        )}
      <div className="os-home-bottom">
        <Suspense
          fallback={
            <p className="os-description">今日の一手を確認しています…</p>
          }
        >
          <NextActions />
        </Suspense>
        <Suspense
          fallback={
            <p className="os-description">自分への連絡を確認しています…</p>
          }
        >
          <PersonalInbox />
        </Suspense>
      </div>
      <div className="os-home-links">
        <Link href="/dashboard/activity">活動の振り返り</Link>
        <Link href="/dashboard/updates">OS更新情報</Link>
        <Link href="/dashboard/work/library">資料・事例を探す</Link>
      </div>
    </div>
  );
}
