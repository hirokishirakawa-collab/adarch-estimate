import Link from "next/link";
import { redirect } from "next/navigation";
import { Video, Lock, Users, Globe2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { listMeetingNotes, sourceLabel, visibilityLabel } from "@/lib/meetings/notes";

export const metadata = { title: "会議メモ | Ad-Arch Group OS" };

// ---------------------------------------------------------------
// 会議メモ一覧
//   自分が書いた分・指名された分・匿名版が全社に出ている分だけが並ぶ。
//   原文を開けない行は社名・発言が落ちた形で届く（lib/meetings/notes.ts で落としてから渡す）。
// ---------------------------------------------------------------

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function MeetingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = {
    email: session.user.email,
    role: (session.user.role ?? "USER") as "ADMIN" | "MANAGER" | "USER",
  };
  const notes = await listMeetingNotes(viewer);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
          <Video className="text-indigo-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-zinc-900">会議メモ</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Web会議・訪問の要約を残す面です。<strong className="text-zinc-700">原文（社名・相手の発言）は書いた人・本部・指名した人だけ</strong>。
            全社に出るのは社名と人名を伏せた要点だけです
          </p>
        </div>
        <Link href="/dashboard/meetings/new" className="ml-auto text-xs px-3 py-2 bg-zinc-800 text-white rounded shrink-0">
          会議メモを残す
        </Link>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-zinc-500 bg-white rounded-lg border border-zinc-200 px-4 py-8 text-center">
          まだ会議メモはありません。「会議メモを残す」から、またはAI連携に「今のWeb会議をOSに残して」と頼んでください
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-white rounded-lg border border-zinc-200 px-4 py-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/dashboard/meetings/${n.id}`} className="text-sm font-bold text-zinc-900 hover:underline">
                      {n.title}
                    </Link>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                      n.visibility === "GROUP" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : n.visibility === "ALLOWED" ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>
                      {n.visibility === "GROUP" ? <Globe2 className="w-3 h-3" /> : n.visibility === "ALLOWED" ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {visibilityLabel(n.visibility)}
                    </span>
                    {!n.full && <span className="text-[10px] text-zinc-400">匿名版</span>}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {fmt(n.meetingAt)}・{sourceLabel(n.source)}
                    {n.durationMin ? `・${n.durationMin}分` : ""}・{n.author}
                    {[n.industry, n.prefecture].filter(Boolean).length > 0 && `・${[n.industry, n.prefecture].filter(Boolean).join("／")}`}
                  </p>
                  {n.concerns.length > 0 && (
                    <p className="text-[11px] text-zinc-600 mt-1.5">
                      <span className="text-amber-700 font-bold">気にしている点</span>：{n.concerns.slice(0, 2).join(" ／ ")}
                      {n.concerns.length > 2 && ` ほか${n.concerns.length - 2}`}
                    </p>
                  )}
                  {n.winPoints.length > 0 && (
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      <span className="text-emerald-700 font-bold">刺さった点</span>：{n.winPoints.slice(0, 2).join(" ／ ")}
                      {n.winPoints.length > 2 && ` ほか${n.winPoints.length - 2}`}
                    </p>
                  )}
                </div>
                <Link href={`/dashboard/meetings/${n.id}`} className="text-xs px-2.5 py-1 border border-zinc-200 rounded hover:bg-zinc-50 shrink-0">
                  開く
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
