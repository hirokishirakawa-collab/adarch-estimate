// ==============================================================
// ダッシュボード最上部の「みんなのチャット」
//   /live に入らなくても、ダッシュボードを開いた時点でチャットが目に入る
//   （投稿が0件でも常に出す＝代表指示 2026-09-01）。全画面は /dashboard/live
// ==============================================================

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { GroupChat } from "./group-chat";

export function DashboardChatCard() {
  return (
    <section className="rounded-2xl bg-[#0a0d13] text-zinc-200 overflow-hidden border border-white/[0.06]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
        <MessageCircle className="w-4 h-4 text-emerald-300" />
        <span className="text-[13px] font-semibold text-white">みんなのチャット</span>
        <span className="text-[10.5px] text-zinc-500 hidden sm:inline">全員に見えます・📎で案件を紐づけて聞けます</span>
        <Link href="/dashboard/live" className="ml-auto text-[11px] text-emerald-300 hover:underline whitespace-nowrap">
          地図と一緒に見る →
        </Link>
      </div>
      <GroupChat maxHeightClass="max-h-[300px]" />
    </section>
  );
}
