import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createMeetingNote } from "../actions";
import { MEETING_SOURCE_OPTIONS, MEETING_VISIBILITY_OPTIONS } from "@/lib/meetings/notes";

export const metadata = { title: "会議メモを残す | Ad-Arch Group OS" };

// 会議メモの新規作成。AI連携（log_meeting）から入れるときと同じ項目。

const field = "block w-full mt-1 text-sm border border-zinc-200 rounded px-2.5 py-1.5";
const label = "text-[11px] text-zinc-500 block";

export default async function NewMeetingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full space-y-4">
      <div>
        <Link href="/dashboard/meetings" className="text-xs text-zinc-500 hover:text-zinc-800">← 会議メモ</Link>
        <h2 className="text-lg font-bold text-zinc-900 mt-1">会議メモを残す</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          原文は<strong className="text-zinc-700">自分・本部・指名した人だけ</strong>が読めます。「匿名版」に書いた内容だけが全社に出ます（社名・人名は書かないでください）
        </p>
      </div>

      <form action={createMeetingNote} className="space-y-4">
        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-4 space-y-3">
          <label className={label}>
            会議名（社名を入れてかまいません）
            <input name="title" required maxLength={200} className={field} placeholder="株式会社◯◯ 初回ヒアリング" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              日時
              <input type="datetime-local" name="meetingAt" className={field} />
            </label>
            <label className={label}>
              時間（分）
              <input type="number" name="durationMin" min={1} max={600} className={field} placeholder="45" />
            </label>
            <label className={label}>
              形式
              <select name="source" className={field} defaultValue="ZOOM">
                {MEETING_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className={label}>
              相手の出席者（役職まで）
              <input name="counterpart" maxLength={200} className={field} placeholder="営業部長・担当者" />
            </label>
            <label className={label}>
              業種（匿名版に出ます）
              <input name="industry" maxLength={60} className={field} placeholder="小売業" />
            </label>
            <label className={label}>
              都道府県（匿名版に出ます）
              <input name="prefecture" maxLength={20} className={field} placeholder="広島県" />
            </label>
          </div>
          <label className={label}>
            顧客ID（分かれば・顧客ページのURL末尾）
            <input name="customerId" maxLength={40} className={field} placeholder="cmu3g..." />
          </label>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">原文（指名した人まで）</p>
          <label className={label}>
            要約
            <textarea name="summary" required rows={6} maxLength={8000} className={field} placeholder="話した順に要点を。相手の言葉はそのまま残すと後から効きます" />
          </label>
          <label className={label}>
            懸念・宿題（1行に1つ）
            <textarea name="objections" rows={3} className={field} placeholder="他社と比較中&#10;年度予算の確定は11月" />
          </label>
          <label className={label}>
            次の一手（1行に1つ）
            <textarea name="nextActions" rows={3} className={field} placeholder="来週までに市単位の試算を送る" />
          </label>
        </div>

        <div className="bg-white rounded-lg border border-emerald-200 px-4 py-4 space-y-3">
          <p className="text-xs font-bold text-emerald-700">全社に出る部分（社名・人名は書かない）</p>
          <label className={label}>
            クライアントが気にしていた点（1行に1つ）
            <textarea name="concerns" rows={3} className={field} placeholder="「テレビCMは高い」という先入観&#10;効果の測り方" />
          </label>
          <label className={label}>
            刺さった点・勝ちパターン（1行に1つ）
            <textarea name="winPoints" rows={3} className={field} placeholder="市単位で出せると伝えた瞬間に前のめりになった" />
          </label>
          <label className={label}>
            匿名版の要約（全社に出す1〜3行）
            <textarea name="sharedSummary" rows={3} maxLength={3000} className={field} placeholder="地方の小売。テレビCMは高いという先入観があり、市単位の見積で一気に前進" />
          </label>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 px-4 py-4 space-y-3">
          <p className="text-xs font-bold text-zinc-700">公開範囲</p>
          <div className="space-y-2">
            {MEETING_VISIBILITY_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-start gap-2 text-xs text-zinc-700">
                <input type="radio" name="visibility" value={o.value} defaultChecked={o.value === "PRIVATE"} className="mt-0.5" />
                <span><strong>{o.label}</strong> — <span className="text-zinc-500">{o.desc}</span></span>
              </label>
            ))}
          </div>
          <label className={label}>
            原文を開く人（メールアドレス・カンマ区切り）
            <input name="allowedEmails" className={field} placeholder="member@adarch.co.jp, another@adarch.co.jp" />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="text-sm px-4 py-2 bg-zinc-800 text-white rounded">残す</button>
          <Link href="/dashboard/meetings" className="text-xs text-zinc-500 underline">やめる</Link>
        </div>
      </form>
    </div>
  );
}
