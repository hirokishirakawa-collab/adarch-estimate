import Link from "next/link";
import { db } from "@/lib/db";
import { PREFECTURES } from "@/lib/constants/crm";
import { nextAnniversary, anniversaryLabel } from "@/lib/anniversary/calc";
import { areaLabel } from "@/lib/anniversary/area";
import type { LeadStatus } from "@/generated/prisma/client";

/**
 * ダッシュボードの「今月の周年」カード。
 *
 * 周年ファインダーを開かない人にも、担当エリアで周年を迎える会社が目に入るようにする。
 * 拠点が分かる人は自分の県だけ、分からない人（本部含む）は全国から出す。
 */

/**
 * 拠点名から都道府県を割り出す。拠点名は「香川県」「京都」「山口・広島」等の揺れがある。
 *
 * まず正式名（香川県・東京都）で探し、見つからない時だけ接尾辞なし（京都・徳島）で探す。
 * 1回で両方を見ると「東京都」が「京都」にも当たってしまうため、この順番は変えないこと。
 */
function prefecturesFromBranchName(branchName: string | null | undefined): string[] {
  if (!branchName) return [];
  const all = (PREFECTURES as readonly string[]).filter((p) => p !== "海外");

  const exact = all.filter((p) => branchName.includes(p));
  if (exact.length > 0) return exact;

  return all.filter((p) => branchName.includes(p.replace(/[都道府県]$/, "")));
}

export async function AnniversaryCard({ userEmail }: { userEmail?: string | null }) {
  const user = userEmail
    ? await db.user.findUnique({
        where: { email: userEmail },
        select: { branch: { select: { name: true } } },
      })
    : null;

  const myPrefs = prefecturesFromBranchName(user?.branch?.name);

  const rows = await db.lead.findMany({
    where: {
      foundedYear: { not: null },
      status: { notIn: ["SKIPPED", "ARCHIVED"] as LeadStatus[] },
      ...(myPrefs.length > 0
        ? {
            OR: [
              { prefecture: { in: myPrefs } },
              ...myPrefs.map((p) => ({ address: { contains: p } })),
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      prefecture: true,
      address: true,
      foundedYear: true,
      foundedMonth: true,
    },
    take: 1000,
  });

  const today = new Date();
  const items = rows
    .map((lead) => ({ lead, anniv: nextAnniversary(lead.foundedYear!, lead.foundedMonth, today) }))
    .filter((x): x is { lead: (typeof rows)[number]; anniv: NonNullable<typeof x.anniv> } => x.anniv !== null)
    // 「今年これから迎える」だけ。来年以降は今この場で知る必要がない
    .filter((x) => x.anniv.monthsAway <= 12)
    .sort((a, b) => {
      if (a.anniv.isMilestone !== b.anniv.isMilestone) return a.anniv.isMilestone ? -1 : 1;
      if (a.anniv.monthsAway !== b.anniv.monthsAway) return a.anniv.monthsAway - b.anniv.monthsAway;
      return b.anniv.years - a.anniv.years;
    });

  if (items.length === 0) return null;

  const areaTitle = myPrefs.length > 0 ? myPrefs.join("・") : "全国";
  const href =
    myPrefs.length === 1
      ? `/dashboard/anniversary-finder?window=year&pref=${encodeURIComponent(myPrefs[0])}`
      : "/dashboard/anniversary-finder?window=year";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">🎂</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-zinc-800">
            今年これから周年を迎える会社（{areaTitle}）
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {items.length}社。記念広告・記念動画を提案しやすいタイミングです
          </p>
        </div>
        <Link
          href={href}
          className="hidden sm:inline-flex rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 flex-shrink-0"
        >
          一覧を見る
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5">
        {items.slice(0, 5).map(({ lead, anniv }) => (
          <li key={lead.id} className="flex items-center gap-2 text-xs">
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 font-bold ${
                anniv.isMilestone ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {anniversaryLabel(anniv, today)}
            </span>
            <span className="truncate text-zinc-700">{lead.name}</span>
            {areaLabel(lead.prefecture, lead.address) && (
              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">
                {areaLabel(lead.prefecture, lead.address)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className="mt-3 inline-flex sm:hidden rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600"
      >
        一覧を見る
      </Link>
    </div>
  );
}
