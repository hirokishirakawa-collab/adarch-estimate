import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSentMessageGroup } from "@/lib/outreach/sent-messages";
import { CopyUrlButton } from "../copy-url-button";

// 1つの営業文の詳細（チャットで共有するURL）。宛名は伏せ、送った先は市と業種だけ出す
interface Props {
  params: Promise<{ id: string }>;
}

export default async function OutreachMessageDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{12}$/.test(id)) notFound();
  const g = await getSentMessageGroup(id);
  if (!g) notFound();

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full space-y-5">
      <Link href="/dashboard/outreach-messages" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="w-3.5 h-3.5" />送った営業文の一覧へ
      </Link>

      <div className="bg-white rounded-lg border border-zinc-200 px-5 py-4 space-y-2">
        <h2 className="text-lg font-bold text-zinc-900">{g.title}</h2>
        {g.appeal && <p className="text-xs text-teal-700">訴求：{g.appeal}</p>}
        <p className="text-xs text-zinc-500">
          {g.branch ?? g.sender}（{g.sender}）・{g.day}・
          {[g.emailCount && `メール${g.emailCount}`, g.formCount && `フォーム${g.formCount}`].filter(Boolean).join("／")}
        </p>
        {g.industries.length > 0 && <p className="text-xs text-zinc-500">業種：{g.industries.join("・")}</p>}
        {g.areas.length > 0 && <p className="text-xs text-zinc-500">送った先の地域：{g.areas.join("・")}</p>}
        <div className="flex items-center gap-5 pt-1">
          <div><p className="text-[10px] text-zinc-400">送った数</p><p className="text-xl font-bold text-zinc-800">{g.sent}</p></div>
          <div><p className="text-[10px] text-zinc-400">開封（MailSuite）</p><p className="text-xl font-bold text-sky-700">{g.opened}</p></div>
          <div><p className="text-[10px] text-zinc-400">クリック</p><p className="text-xl font-bold text-sky-800">{g.clicked}</p></div>
          <div><p className="text-[10px] text-zinc-400">返事待ち</p><p className="text-xl font-bold text-zinc-500">{g.waiting}</p></div>
          {g.results.map((r) => (
            <div key={r.value}><p className="text-[10px] text-zinc-400">{r.label}</p><p className="text-xl font-bold text-zinc-800">{r.count}</p></div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-400">開封・クリックは MailSuite を使っている人が登録した分だけの社数です。開封は目安（相手側の自動チェックでも開封になります）。</p>
        <div className="pt-1"><CopyUrlButton path={`/dashboard/outreach-messages/${g.id}`} /></div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-zinc-500">
          送った本文{g.variants.length > 1 ? `（地域などを差し込んだ${g.variants.length}パターン）` : ""}。宛名は「◯◯」に伏せています。
        </p>
        {g.variants.map((v, i) => (
          <div key={i} className="bg-white rounded-lg border border-zinc-200 px-5 py-4">
            <p className="text-[11px] text-zinc-400 mb-2">
              {v.areas.length > 0 ? v.areas.join("・") : "地域なし"}・{v.count}件
            </p>
            <pre className="text-sm text-zinc-800 whitespace-pre-wrap font-sans leading-relaxed">{v.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
