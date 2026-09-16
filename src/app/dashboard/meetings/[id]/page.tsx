import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { auth } from "@/lib/auth";
import { getMeetingNote, sourceLabel, visibilityLabel, MEETING_VISIBILITY_OPTIONS } from "@/lib/meetings/notes";
import { updateMeetingAccess } from "../actions";

// 会議メモの詳細。見えない人には 404（判定は lib/meetings/notes.ts に一本化）

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

const Bullets = ({ title, items, tone }: { title: string; items: string[]; tone: string }) =>
  items.length === 0 ? null : (
    <div>
      <p className={`text-xs font-bold ${tone}`}>{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((t, i) => <li key={i} className="text-sm text-zinc-700">・{t}</li>)}
      </ul>
    </div>
  );

export default async function MeetingNotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const { id } = await params;
  const note = await getMeetingNote(
    { email: session.user.email, role: (session.user.role ?? "USER") as "ADMIN" | "MANAGER" | "USER" },
    id
  );
  if (!note) notFound();

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full space-y-4">
      <div>
        <Link href="/dashboard/meetings" className="text-xs text-zinc-500 hover:text-zinc-800">← 会議メモ</Link>
        <h2 className="text-lg font-bold text-zinc-900 mt-1">{note.title}</h2>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {fmt(note.meetingAt)}・{sourceLabel(note.source)}{note.durationMin ? `・${note.durationMin}分` : ""}・{note.author}
          {[note.industry, note.prefecture].filter(Boolean).length > 0 && `・${[note.industry, note.prefecture].filter(Boolean).join("／")}`}
          ・{visibilityLabel(note.visibility)}
        </p>
      </div>

      {!note.full && (
        <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded px-3 py-2 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-400" />
          これは匿名版です。社名・相手の発言・次の一手は出していません。中身が要るときは、書いた本人に開いてもらってください
        </p>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 px-4 py-4 space-y-4">
        {note.full ? (
          <>
            {(note.customerName || note.counterpart) && (
              <p className="text-[11px] text-zinc-500">
                {note.customerName && <>相手先：{note.customerId ? <Link className="underline" href={`/dashboard/customers/${note.customerId}`}>{note.customerName}</Link> : note.customerName}　</>}
                {note.counterpart && <>出席：{note.counterpart}</>}
              </p>
            )}
            <div>
              <p className="text-xs font-bold text-zinc-700">要約</p>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap mt-1">{note.summary}</p>
            </div>
          </>
        ) : (
          note.sharedSummary && <p className="text-sm text-zinc-800 whitespace-pre-wrap">{note.sharedSummary}</p>
        )}
        <Bullets title="クライアントが気にしていた点" items={note.concerns} tone="text-amber-700" />
        <Bullets title="刺さった点・勝ちパターン" items={note.winPoints} tone="text-emerald-700" />
        <Bullets title="懸念・宿題" items={note.objections} tone="text-zinc-700" />
        <Bullets title="次の一手" items={note.nextActions} tone="text-sky-700" />
      </div>

      {note.full && (
        <form action={updateMeetingAccess} className="bg-white rounded-lg border border-zinc-200 px-4 py-4 space-y-3">
          <input type="hidden" name="id" value={note.id} />
          <p className="text-xs font-bold text-zinc-700">公開範囲を変える</p>
          <div className="space-y-2">
            {MEETING_VISIBILITY_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-start gap-2 text-xs text-zinc-700">
                <input type="radio" name="visibility" value={o.value} defaultChecked={o.value === note.visibility} className="mt-0.5" />
                <span><strong>{o.label}</strong> — <span className="text-zinc-500">{o.desc}</span></span>
              </label>
            ))}
          </div>
          <label className="text-[11px] text-zinc-500 block">
            原文を開く人（メールアドレス・カンマ区切り）
            <input name="allowedEmails" defaultValue={note.allowedEmails.join(", ")} className="block w-full mt-1 text-sm border border-zinc-200 rounded px-2.5 py-1.5" />
          </label>
          <button type="submit" className="text-xs px-3 py-1.5 bg-zinc-800 text-white rounded">更新する</button>
        </form>
      )}
    </div>
  );
}
