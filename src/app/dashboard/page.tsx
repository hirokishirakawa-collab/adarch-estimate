import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { LiveBoard } from "@/components/live/live-board";
import { NextActions } from "@/components/workspace/next-actions";
import { PersonalInbox } from "@/components/workspace/personal-inbox";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="os-page">
      <div className="os-page-head">
        <div>
          <h1>ホーム</h1>
          <p className="os-description">みんなの動きから、今日の一手へ。</p>
        </div>
        <Link className="os-button-secondary" href="/dashboard/ai">
          AIでできる仕事 →
        </Link>
      </div>
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
