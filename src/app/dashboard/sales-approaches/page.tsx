import Link from "next/link";
import { Plus, Send, MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth";
import { getSalesApproaches, getSalesApproachStats } from "@/lib/actions/sales-approach";
import { getResultOption, getMethodLabel, RESULT_OPTIONS, INDUSTRY_OPTIONS } from "@/lib/constants/sales-approach";
import { DeleteButton } from "./delete-button";
import { ExpandableText } from "./expandable-text";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";

interface Props {
  searchParams: Promise<{ result?: string; industry?: string }>;
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short", day: "numeric", timeZone: "Asia/Tokyo",
  }).format(new Date(d));
}

export default async function SalesApproachesPage({ searchParams }: Props) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const params = await searchParams;
  const [approaches, stats] = await Promise.all([
    getSalesApproaches({ result: params.result, industry: params.industry }),
    getSalesApproachStats(),
  ]);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
            <Send className="text-teal-700" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">アプローチ事例集</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              成功も失敗もグループの資産に — どんな文面でどう送ったか
            </p>
            <WikiHelpLink query="アプローチ事例集" />
          </div>
        </div>
        <Link
          href="/dashboard/sales-approaches/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white
                     text-xs font-medium rounded-lg hover:bg-teal-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />投稿する
        </Link>
      </div>

      {/* 集計 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "全件", value: stats.total, cls: "text-zinc-800" },
          { label: "商談化", value: stats.deal, cls: "text-emerald-700" },
          { label: "返信（前向き）", value: stats.repliedOk, cls: "text-teal-700" },
          { label: "返信（不成立）", value: stats.repliedNg, cls: "text-amber-700" },
          { label: "未返信", value: stats.noReply, cls: "text-zinc-500" },
          { label: "拒否", value: stats.rejected, cls: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-zinc-200 px-3 py-2.5">
            <p className="text-[10px] text-zinc-400">{s.label}</p>
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* フィルタ */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-zinc-400">結果:</span>
        <Link
          href="/dashboard/sales-approaches"
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
            !params.result ? "bg-zinc-800 text-white border-zinc-800" : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          すべて
        </Link>
        {RESULT_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/dashboard/sales-approaches?result=${opt.value}${params.industry ? `&industry=${params.industry}` : ""}`}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              params.result === opt.value ? `${opt.className} font-semibold` : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {opt.label}
          </Link>
        ))}

        <span className="text-[10px] text-zinc-400 ml-3">業種:</span>
        <Link
          href={`/dashboard/sales-approaches${params.result ? `?result=${params.result}` : ""}`}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
            !params.industry ? "bg-zinc-800 text-white border-zinc-800" : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          すべて
        </Link>
        {INDUSTRY_OPTIONS.slice(0, 8).map((ind) => (
          <Link
            key={ind}
            href={`/dashboard/sales-approaches?industry=${ind}${params.result ? `&result=${params.result}` : ""}`}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              params.industry === ind ? "bg-teal-50 text-teal-700 border-teal-200 font-semibold" : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {ind}
          </Link>
        ))}
      </div>

      {/* 一覧 */}
      {approaches.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 px-4 py-16 text-center">
          <p className="text-sm text-zinc-400">まだ投稿がありません</p>
          <Link
            href="/dashboard/sales-approaches/new"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-teal-700 text-white text-xs font-medium rounded-lg hover:bg-teal-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />最初のアプローチを投稿する
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {approaches.map((a) => {
            const res = getResultOption(a.result);
            return (
              <div key={a.id} className="bg-white rounded-xl border border-zinc-200 p-4">
                {/* ヘッダー */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${res.className}`}>
                    {res.label}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-teal-50 border border-teal-200 text-teal-700">
                    {a.industry}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-zinc-50 border border-zinc-200 text-zinc-600">
                    {getMethodLabel(a.method)}
                  </span>
                  {a.customer && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                      {a.customer.name}
                    </span>
                  )}
                  {a.targetDesc && (
                    <span className="text-[10px] text-zinc-400">{a.targetDesc}</span>
                  )}
                </div>

                {/* 文面 */}
                <div className="bg-zinc-50 rounded-lg border border-zinc-100 px-4 py-3 mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="w-3 h-3 text-zinc-400" />
                    <span className="text-[10px] font-semibold text-zinc-400">送信文面</span>
                  </div>
                  <ExpandableText text={a.messageBody} />
                </div>

                {/* 学び */}
                {a.learnings && (
                  <div className="bg-blue-50/50 rounded-lg border border-blue-100 px-4 py-2.5 mb-3">
                    <p className="text-[10px] font-semibold text-blue-500 mb-1">学び・振り返り</p>
                    <p className="text-xs text-zinc-700 whitespace-pre-wrap">{a.learnings}</p>
                  </div>
                )}

                {/* 投稿者・日時 */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-400">
                    {a.groupCompany.name}（{a.author?.name ?? a.groupCompany.ownerName}）
                    ／ {fmtDate(a.createdAt)}
                  </p>
                  {isAdmin && <DeleteButton id={a.id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
