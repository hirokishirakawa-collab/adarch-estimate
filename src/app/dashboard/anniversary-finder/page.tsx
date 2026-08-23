import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PREFECTURES } from "@/lib/constants/crm";
import { nextAnniversary, anniversaryLabel } from "@/lib/anniversary/calc";
import { areaLabel } from "@/lib/anniversary/area";
import { AnniversaryList, type AnniversaryRow } from "@/components/anniversary/anniversary-list";
import type { LeadStatus } from "@/generated/prisma/client";

export const metadata = { title: "周年ファインダー" };
export const dynamic = "force-dynamic";

// 期間の選び方。設立月が取れていない会社は「今年ぶん」「来年まで」にだけ出す
// （月が分からないのに「今月です」とは言えないため）。
const WINDOWS = [
  { value: "3m", label: "3ヶ月以内", months: 3, needsMonth: true },
  { value: "6m", label: "半年以内", months: 6, needsMonth: true },
  { value: "year", label: "今年ぶん（月不明も含む）", months: 12, needsMonth: false },
  { value: "next", label: "来年まで", months: 24, needsMonth: false },
] as const;

export default async function AnniversaryFinderPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; pref?: string; milestone?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const pref = params.pref ?? "";
  const milestoneOnly = params.milestone === "1";
  const win = WINDOWS.find((w) => w.value === params.window) ?? WINDOWS[0];

  const rows = await db.lead.findMany({
    where: {
      foundedYear: { not: null },
      // 却下済み（同業・競合を含む）とアーカイブは出さない。
      // リード管理・営業フローと同じ不可視化に揃える（[[feedback_tver_rejected_hidden]]）。
      status: { notIn: ["SKIPPED", "ARCHIVED"] as LeadStatus[] },
      ...(pref ? { OR: [{ prefecture: pref }, { address: { contains: pref } }] } : {}),
    },
    select: {
      id: true,
      name: true,
      prefecture: true,
      address: true,
      employeeCount: true,
      industry: true,
      foundedYear: true,
      foundedMonth: true,
      foundedRaw: true,
      foundedSourceUrl: true,
      signalKind: true,
      pressReleaseUrl: true,
      websiteUrl: true,
      phone: true,
      email: true,
    },
    take: 2000,
  });

  const today = new Date();
  const items = rows
    .map((lead) => {
      const anniv = nextAnniversary(lead.foundedYear!, lead.foundedMonth, today);
      return anniv ? { lead, anniv } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter(({ anniv }) => {
      // 月が不明な会社は、月を要求する期間（3ヶ月以内・半年以内）には出さない
      if (anniv.onMonth === null && win.needsMonth) return false;
      return anniv.monthsAway <= win.months;
    })
    .filter(({ anniv }) => (milestoneOnly ? anniv.isMilestone : true))
    .sort((a, b) => {
      if (a.anniv.isMilestone !== b.anniv.isMilestone) return a.anniv.isMilestone ? -1 : 1;
      if (a.anniv.monthsAway !== b.anniv.monthsAway) return a.anniv.monthsAway - b.anniv.monthsAway;
      return b.anniv.years - a.anniv.years;
    });

  // クライアント側（チェック選択・CSV書き出し）へ渡す素の値。
  const listRows: AnniversaryRow[] = items.map(({ lead, anniv }) => ({
    id: lead.id,
    name: lead.name,
    area: areaLabel(lead.prefecture, lead.address),
    industry: lead.industry,
    employeeCount: lead.employeeCount,
    foundedYear: lead.foundedYear!,
    foundedMonth: lead.foundedMonth,
    foundedRaw: lead.foundedRaw,
    foundedSourceUrl: lead.foundedSourceUrl,
    pressReleaseUrl: lead.pressReleaseUrl,
    websiteUrl: lead.websiteUrl,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    isAnnivSignal: lead.signalKind === "ANNIV",
    annivLabel: anniversaryLabel(anniv, today),
    annivYears: anniv.years,
    annivOnYear: anniv.onYear,
    annivOnMonth: anniv.onMonth,
    isMilestone: anniv.isMilestone,
  }));

  const filled = await db.lead.count({
    where: { foundedYear: { not: null }, status: { notIn: ["SKIPPED", "ARCHIVED"] as LeadStatus[] } },
  });
  const checked = await db.lead.count({ where: { foundedCheckedAt: { not: null } } });
  const remaining = await db.lead.count({
    where: { foundedCheckedAt: null, websiteUrl: { not: null } },
  });

  const selectClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ── ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">🎂</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">周年ファインダー</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            もうすぐ節目の周年を迎える会社を出します。記念広告・記念動画・記念誌の提案が通りやすいタイミングです
          </p>
        </div>
      </div>

      {/* ── 読み方（客先で外さないための線引き） */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-xs text-rose-900 leading-relaxed">
        <p className="font-semibold">この画面の読み方</p>
        <p className="mt-1">
          設立・創業年は<span className="font-semibold">相手の会社概要ページと PR TIMES から機械的に拾ったもの</span>で、
          登記情報ではありません。拾った原文をそのまま並べているので、
          <span className="font-semibold">声をかける前に出典リンクで一度ご確認ください。</span>
          <br />
          設立「月」まで書いていない会社が多く、その場合は「今年◯周年」までしか分かりません（月は推測していません）。
          <br />
          同業（動画制作会社・広告代理店）が混ざっていたら、
          <span className="font-semibold">「営業対象から外す」</span>
          で消してください。リード管理・営業フローからも見えなくなります。
        </p>
      </div>

      {/* ── 絞り込み */}
      <form method="get" className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">いつ迎えるか</span>
            <select name="window" defaultValue={win.value} className={`mt-1 ${selectClass}`}>
              {WINDOWS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600">都道府県</span>
            <select name="pref" defaultValue={pref} className={`mt-1 ${selectClass}`}>
              <option value="">指定しない（全国）</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3 lg:col-span-2">
            <label className="flex items-center gap-2 text-xs text-zinc-600 pb-2">
              <input
                type="checkbox"
                name="milestone"
                value="1"
                defaultChecked={milestoneOnly}
                className="h-4 w-4 rounded border-zinc-300"
              />
              節目だけ（10・20・30・50・100周年など）
            </label>
            <button
              type="submit"
              className="ml-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              絞り込む
            </button>
          </div>
        </div>
      </form>

      {/* ── 件数と母集団の埋まり具合 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>{items.length}件</span>
        <span>
          設立年が判明: {filled.toLocaleString("ja-JP")}社 / 調査済み {checked.toLocaleString("ja-JP")}社
          {remaining > 0 && `・未調査 ${remaining.toLocaleString("ja-JP")}社（日次で順に調べます）`}
        </span>
      </div>

      {/* ── 一覧 */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          該当する会社がありません。期間を広げるか、節目のチェックを外してください。
          <br />
          <span className="text-xs">
            1件も出ない場合は、まだ同期が走っていない可能性があります（日次: /api/cron/anniversary-sync）。
          </span>
        </div>
      ) : (
        <AnniversaryList rows={listRows} />
      )}
    </div>
  );
}
