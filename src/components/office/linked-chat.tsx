// ==============================================================
// 案件ページに出す「グループチャットでの会話」（サーバーコンポーネント）
//   この案件に紐づけて語られた会話＝動線・進め方の履歴。後から加盟した人も読める
//   ⚠️ 金額は元から書かれない場
// ==============================================================

import Link from "next/link";
import { db } from "@/lib/db";
import { MessageCircle } from "lucide-react";

export async function LinkedChat({ kind, id, title }: { kind: "deal" | "customer" | "project" | "package"; id: string; title?: string }) {
  let rows: { id: string; text: string; createdAt: Date; user: { name: string | null; email: string } }[] = [];
  try {
    rows = await db.officeChatMessage.findMany({
      where: { refKind: kind, refId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, text: true, createdAt: true, user: { select: { name: true, email: true } } },
    });
  } catch {
    rows = [];
  }
  const liveHref = `/dashboard/live?ref=${kind}:${encodeURIComponent(id)}${title ? `&t=${encodeURIComponent(title.slice(0, 80))}` : ""}`;

  return (
    <div className="border-t border-zinc-100">
      <div className="px-5 py-3 bg-zinc-50 flex items-center gap-2">
        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          グループチャットでの会話 ({rows.length}{rows.length >= 5 ? "+" : ""})
        </h2>
        <Link href={liveHref} className="ml-auto text-[11px] text-emerald-700 hover:underline">
          {rows.length > 0 ? "続きを見る・聞く →" : "みんなに聞く →"}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-[12px] text-zinc-500 leading-relaxed">
          まだ会話はありません。「{title ?? "この案件"}の動線は何でしたか？」のように、グループライブのチャットに紐づけて聞くと、答えがここに残ります。
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {rows.reverse().map((r) => {
            const bot = r.user.email === "arch-kun@adarch.co.jp";
            return (
              <li key={r.id} className="px-5 py-3">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[12px] font-semibold ${bot ? "text-indigo-700" : "text-zinc-800"}`}>
                    {bot ? "アーチくん" : (r.user.name ?? r.user.email.split("@")[0])}
                  </span>
                  <span className="text-[10.5px] text-zinc-400">
                    {new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(r.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-zinc-700 leading-relaxed whitespace-pre-wrap break-words">{r.text}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
