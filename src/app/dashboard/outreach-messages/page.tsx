import Link from "next/link";
import { Mail } from "lucide-react";
import { getSentMessageGroups, replyRate, type SentMessageSort } from "@/lib/outreach/sent-messages";
import { CopyUrlButton } from "./copy-url-button";
import { MailTrackingForm } from "./mail-tracking-form";

// ---------------------------------------------------------------
// 送った営業文（グループ共有）
//   メール・フォームで送った文面を、同じ送り手・同じ日・同じ件名の型ごとにまとめて見返す。
//   宛名は伏せる。送付記録は返事待ち・送付台帳・事例集の元なので、この画面からは消さない
//   （一覧の基本セットのうち一括選択・一括削除は入れない）。
// ---------------------------------------------------------------

interface Props {
  searchParams: Promise<{ from?: string; to?: string; sort?: string }>;
}

const SORTS: { value: SentMessageSort; label: string }[] = [
  { value: "result", label: "結果が出ている順" },
  { value: "new", label: "新しい順" },
  { value: "count", label: "送った数の多い順" },
  { value: "replied", label: "返信の多い順" },
  { value: "opened", label: "開封の多い順" },
  { value: "clicked", label: "クリックの多い順" },
];

const parseDay = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00+09:00`) : undefined);

export default async function OutreachMessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const sort = (SORTS.find((s) => s.value === params.sort)?.value ?? "result") as SentMessageSort;
  const from = parseDay(params.from);
  const toDay = parseDay(params.to);
  const to = toDay ? new Date(+toDay + 86_400_000) : undefined;
  const groups = await getSentMessageGroups({ from, to, sort });

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
          <Mail className="text-teal-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">送った営業文</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            グループの誰かがメール・フォームで送った文面を、そのまま参考にできます（宛名は伏せています）。
            はじめは<strong className="text-zinc-700">結果が出ている順</strong>（返信 → クリック → 開封の率。送った数が少ないものは控えめに見ます）
          </p>
        </div>
      </div>

      <MailTrackingForm />

      <form className="flex items-end gap-3 flex-wrap bg-white rounded-lg border border-zinc-200 px-4 py-3" method="get">
        <label className="text-[11px] text-zinc-500">
          送った日（から）
          <input type="date" name="from" defaultValue={params.from ?? ""} className="block mt-1 text-xs border border-zinc-200 rounded px-2 py-1" />
        </label>
        <label className="text-[11px] text-zinc-500">
          送った日（まで）
          <input type="date" name="to" defaultValue={params.to ?? ""} className="block mt-1 text-xs border border-zinc-200 rounded px-2 py-1" />
        </label>
        <label className="text-[11px] text-zinc-500">
          並べ替え
          <select name="sort" defaultValue={sort} className="block mt-1 text-xs border border-zinc-200 rounded px-2 py-1">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button type="submit" className="text-xs px-3 py-1.5 bg-zinc-800 text-white rounded">絞り込む</button>
        <Link href="/dashboard/outreach-messages" className="text-xs text-zinc-500 underline">条件をはずす</Link>
        <span className="text-[11px] text-zinc-400 ml-auto">期間の指定がないときは直近90日</span>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500 bg-white rounded-lg border border-zinc-200 px-4 py-8 text-center">
          この期間に送った営業文はまだありません
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g, i) => (
            <div key={g.id} className={`bg-white rounded-lg border px-4 py-3 ${sort === "result" && i === 0 && (g.replied > 0 || g.clicked > 0 || g.opened > 0) ? "border-emerald-300 ring-1 ring-emerald-100" : "border-zinc-200"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  {sort === "result" && i === 0 && (g.replied > 0 || g.clicked > 0 || g.opened > 0) && (
                    <p className="text-[10px] font-bold text-emerald-700 mb-0.5">いま一番結果が出ている文面</p>
                  )}
                  <Link href={`/dashboard/outreach-messages/${g.id}`} className="text-sm font-bold text-zinc-900 hover:underline">
                    {g.title}
                  </Link>
                  {g.appeal && <p className="text-[11px] text-teal-700 mt-0.5">訴求：{g.appeal}</p>}
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {g.branch ?? g.sender}（{g.sender}）・{g.day}・
                    {[g.emailCount && `メール${g.emailCount}`, g.formCount && `フォーム${g.formCount}`].filter(Boolean).join("／")}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {g.industries.slice(0, 3).join("・")}{g.industries.length > 3 ? " ほか" : ""}
                    {g.areas.length > 0 && `／${g.areas.slice(0, 4).join("・")}${g.areas.length > 4 ? ` ほか${g.areas.length - 4}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-center">
                  <div><p className="text-[10px] text-zinc-400">送った数</p><p className="text-lg font-bold text-zinc-800">{g.sent}</p></div>
                  <div><p className="text-[10px] text-zinc-400">開封</p><p className="text-lg font-bold text-sky-700">{g.opened}</p></div>
                  <div><p className="text-[10px] text-zinc-400">クリック</p><p className="text-lg font-bold text-sky-800">{g.clicked}</p></div>
                  <div><p className="text-[10px] text-zinc-400">返信</p><p className="text-lg font-bold text-emerald-700">{g.replied}</p></div>
                  <div><p className="text-[10px] text-zinc-400">返事待ち</p><p className="text-lg font-bold text-zinc-500">{g.waiting}</p></div>
                  <div><p className="text-[10px] text-zinc-400">返信率</p><p className="text-lg font-bold text-emerald-800">{replyRate(g)}<small className="text-xs font-normal">%</small></p></div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Link href={`/dashboard/outreach-messages/${g.id}`} className="text-xs px-2.5 py-1 border border-zinc-200 rounded hover:bg-zinc-50">本文を開く</Link>
                <CopyUrlButton path={`/dashboard/outreach-messages/${g.id}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
