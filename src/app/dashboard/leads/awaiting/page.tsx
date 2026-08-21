import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { MailQuestion, ExternalLink, UserCheck } from "lucide-react";
import { FavoriteButton } from "@/components/layout/favorite-button";
import { OutreachResultBar } from "@/components/leads/outreach-result-bar";
import { getOutreachResultOption, daysSince, cutoffDaysAgo } from "@/lib/constants/outreach-result";

const PER_PAGE = 100;

// 送付ログの detail は「【訴求】○○\n本文…」の形。1行目から訴求名だけ取り出す
function appealOf(detail: string | null): string {
  if (!detail) return "";
  const first = detail.split("\n")[0] ?? "";
  const m = first.match(/^【訴求】(.*)$/);
  return m ? m[1].trim() : "";
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 経過日数の見た目。放置が長いほど強い色にして、上から手を打てるようにする
function elapsedClass(days: number): string {
  if (days >= 14) return "bg-rose-50 text-rose-700 border-rose-200";
  if (days >= 7) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-zinc-50 text-zinc-500 border-zinc-200";
}

interface PageProps {
  searchParams: Promise<{ tab?: string; mine?: string }>;
}

export default async function LeadAwaitingPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) return null;

  const params = await searchParams;
  const tab = params.tab === "done" ? "done" : "waiting";
  const mine = params.mine === "1";

  const me = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  const mineWhere = mine && me ? { assigneeId: me.id } : {};
  const baseWhere = { sentAt: { not: null }, ...mineWhere };
  const waitingWhere = { ...baseWhere, outreachResult: null };
  const doneWhere = { ...baseWhere, outreachResult: { not: null } };

  const [leads, waitingCount, doneCount] = await Promise.all([
    db.lead.findMany({
      where: tab === "done" ? doneWhere : waitingWhere,
      select: {
        id: true,
        name: true,
        industry: true,
        area: true,
        prefecture: true,
        websiteUrl: true,
        sentAt: true,
        outreachResult: true,
        outreachResultAt: true,
        assignee: { select: { name: true, email: true } },
      },
      // 返事待ちは「古い順」＝放置が長いものを上に。結果入り分は入れた順
      orderBy: tab === "done" ? { outreachResultAt: "desc" } : { sentAt: "asc" },
      take: PER_PAGE,
    }),
    db.lead.count({ where: waitingWhere }),
    db.lead.count({ where: doneWhere }),
  ]);

  // 送付ログ（訴求と送った人）をまとめて引く。distinct でリードごとの最新1件
  const ids = leads.map((l) => l.id);
  const sentLogs = ids.length
    ? await db.leadLog.findMany({
        where: { leadId: { in: ids }, action: "FORM_SENT" },
        orderBy: { createdAt: "desc" },
        distinct: ["leadId"],
        select: { leadId: true, detail: true, staffName: true },
      })
    : [];
  const logByLead = new Map(sentLogs.map((l) => [l.leadId, l]));

  // 返事待ちのうち7日以上放置されている件数（手を打つ判断材料）
  const staleCount = await db.lead.count({
    where: { ...waitingWhere, sentAt: { lt: cutoffDaysAgo(7) } },
  });

  const tabHref = (t: string) => `/dashboard/leads/awaiting?tab=${t}${mine ? "&mine=1" : ""}`;

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ===== ヘッダー ===== */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <MailQuestion className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-zinc-900">返事待ち</h2>
              <FavoriteButton path="/dashboard/leads/awaiting" label="返事待ち" />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              営業フォームで送った先のうち、まだ結果を入れていないもの。結果を押すとグループ事例に自動で残ります
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {me && (
            <Link
              href={`/dashboard/leads/awaiting?tab=${tab}${mine ? "" : "&mine=1"}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                mine
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {mine ? "自分の担当のみ" : "自分の担当"}
            </Link>
          )}
          <Link
            href="/dashboard/leads/list"
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-2 whitespace-nowrap"
          >
            リード管理へ
          </Link>
        </div>
      </div>

      {/* ===== サマリー ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-blue-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold text-blue-700">📨 返事待ち</p>
          <p className="text-3xl font-black text-blue-600 leading-none mt-1">{waitingCount.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">送ったが結果を入れていない</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold text-amber-700">⏳ 7日以上そのまま</p>
          <p className="text-3xl font-black text-amber-600 leading-none mt-1">{staleCount.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">結果を入れるか、次の手を決める</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold text-zinc-600">✅ 結果を入れた</p>
          <p className="text-3xl font-black text-zinc-700 leading-none mt-1">{doneCount.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">そのままグループ事例になる</p>
        </div>
      </div>

      {/* ===== タブ ===== */}
      <div className="flex gap-2">
        {[
          { key: "waiting", label: `返事待ち（${waitingCount}）` },
          { key: "done", label: `結果入力済み（${doneCount}）` },
        ].map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
              tab === t.key
                ? "bg-[#1F3A5F] text-white border-[#1F3A5F]"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ===== 一覧 ===== */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        {leads.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-14">
            {tab === "done"
              ? "まだ結果を入れたリードがありません。"
              : "返事待ちはありません。営業フォームで送付済みにすると、ここに並びます。"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-[11px] font-bold text-zinc-500">
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">経過</th>
                  <th className="px-3 py-2.5 text-left">会社</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">訴求</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">送付</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">送った人</th>
                  <th className="px-3 py-2.5 text-left">結果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {leads.map((lead) => {
                  const log = logByLead.get(lead.id);
                  const days = lead.sentAt ? daysSince(lead.sentAt) : 0;
                  const done = getOutreachResultOption(lead.outreachResult);
                  const meta = [lead.area ?? lead.prefecture, lead.industry].filter(Boolean).join("・");
                  return (
                    <tr key={lead.id} className="hover:bg-zinc-50/60 align-top">
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${elapsedClass(days)}`}
                        >
                          {days}日
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-zinc-900">{lead.name}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">{meta || "—"}</div>
                        {lead.websiteUrl && (
                          <a
                            href={lead.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline mt-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            サイト
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-600 whitespace-nowrap">
                        {appealOf(log?.detail ?? null) || "—"}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-zinc-600 whitespace-nowrap">
                        {fmtDate(lead.sentAt)}
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-600 whitespace-nowrap">
                        {log?.staffName ?? lead.assignee?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <OutreachResultBar leadId={lead.id} result={lead.outreachResult} showLabel={false} />
                        {done && (
                          <p className="text-[10px] text-zinc-400 mt-1">
                            {fmtDate(lead.outreachResultAt)} に記録／もう一度押すと取り消し
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {leads.length >= PER_PAGE && (
        <p className="text-[11px] text-zinc-400 text-center">
          直近{PER_PAGE}件のみ表示しています。結果を入れると減っていきます。
        </p>
      )}

      <p className="text-[11px] text-zinc-400">
        ※ この画面は見るための一覧です。追いかけメールを自動で送ることはありません。
      </p>
    </div>
  );
}
