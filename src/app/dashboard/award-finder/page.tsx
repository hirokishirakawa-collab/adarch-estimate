import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PREFECTURES, toFullPrefecture } from "@/lib/constants/crm";
import { AD_AWARDS } from "@/lib/ad-award/curated";
import { AWARD_CATEGORIES, type AdAward, type AwardCategory } from "@/lib/ad-award/types";
import { entryWindow, type EntryWindow } from "@/lib/ad-award/calc";
import {
  WIN_TIER_META,
  SCOPE_META,
  CONFIDENCE_META,
  RANGE_OPTIONS,
  ALL_PREFECTURES,
  type RangeValue,
} from "@/lib/ad-award/options";
import { CopyPitchButton } from "@/components/ad-award/copy-pitch-button";

export const metadata = { title: "広告賞ファインダー" };
export const dynamic = "force-dynamic";

// ----------------------------------------------------------------
// 自分の拠点県（未指定時の初期値に使う。入札ファインダーと同じ）
// ----------------------------------------------------------------
async function resolveOwnPrefectures(email: string | null | undefined): Promise<string[]> {
  if (!email) return [];
  const user = await db.user.findUnique({
    where: { email },
    select: { groupCompany: { select: { prefecture: true, branchLabels: true } } },
  });
  const gc = user?.groupCompany;
  if (!gc) return [];
  return [...(gc.prefecture ? [gc.prefecture] : []), ...gc.branchLabels]
    .map(toFullPrefecture)
    .filter((p, i, arr) => p && arr.indexOf(p) === i);
}

/** 納品後に先方へ「この作品、この賞に出しませんか」と伝えるときの一文（コピー用）。裏の取れている項目だけを並べる */
function pitchText(a: AdAward, w: EntryWindow): string {
  const parts = [`${a.name}（主催: ${a.organizer}）に出しませんか`];
  if (a.entryPeriodRaw) parts.push(`応募: ${a.entryPeriodRaw}`);
  else parts.push(`応募: ${w.label}`);
  if (a.feeRaw) parts.push(`応募料: ${a.feeRaw}`);
  if (a.pitchNote) parts.push(a.pitchNote);
  return parts.join("／");
}

function windowBadge(w: EntryWindow): string {
  if (w.status === "OPEN") {
    return w.daysToClose !== null && w.daysToClose <= 14
      ? "bg-red-50 text-red-700"
      : "bg-emerald-50 text-emerald-700";
  }
  if (w.status === "UPCOMING" && w.daysToOpen !== null && w.daysToOpen <= 30) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-zinc-100 text-zinc-600";
}

export default async function AwardFinderPage({
  searchParams,
}: {
  searchParams: Promise<{
    pref?: string;
    cat?: string;
    range?: string;
    easyOnly?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const ownPrefectures = await resolveOwnPrefectures(session.user.email);

  // 未指定なら自分の県を初期表示にする（地元の賞が最優先のため）
  const pref = params.pref ?? ownPrefectures[0] ?? ALL_PREFECTURES;
  const cat = (params.cat ?? "") as AwardCategory | "";
  const range: RangeValue = (RANGE_OPTIONS.find((r) => r.value === params.range)?.value ??
    "jp") as RangeValue;
  const easyOnly = params.easyOnly === "1";

  const now = new Date();

  const rows = AD_AWARDS.filter((a) => {
    if (a.scope === "INTERNATIONAL" && range !== "all") return false;
    if (a.scope === "NATIONAL" && range === "local") return false;
    if (a.scope === "REGIONAL" && pref !== ALL_PREFECTURES && !a.prefectures.includes(pref)) {
      return false;
    }
    if (cat && !a.categories.includes(cat)) return false;
    if (easyOnly && a.winTier === "HARD") return false;
    return true;
  })
    .map((a) => ({ a, w: entryWindow(a, now) }))
    // 受付中（締切が近い順）→ 次回開始が近い順 → 締切だけ判明 → 不明
    .sort((x, y) => x.w.sortKey - y.w.sortKey);

  const counts = {
    REGIONAL: rows.filter((r) => r.a.scope === "REGIONAL").length,
    NATIONAL: rows.filter((r) => r.a.scope === "NATIONAL").length,
    INTERNATIONAL: rows.filter((r) => r.a.scope === "INTERNATIONAL").length,
    open: rows.filter((r) => r.w.status === "OPEN").length,
  };

  const selectClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ── ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-yellow-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">🏆</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">広告賞ファインダー</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            納品した作品を「この賞に出しませんか」と追加で提案するための一覧です。地域・制作物の種類から探せます（全国・地方・国際 {AD_AWARDS.length}件）
          </p>
        </div>
      </div>

      {/* ── 使い方の前提 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">この画面の読み方</p>
        <p className="mt-1">
          広告賞は毎年ほぼ同じ内容で日程だけ変わります。日程は確認した年の実績を月日で持ち、
          翌年以降は「次回◯月頃（前年実績）」として出します。
          <span className="font-semibold">「日程は要確認」の賞は、応募前に主催の公式ページか電話で確認してください。</span>
          <br />
          <span className="font-semibold">◎</span> は地元の賞で応募すれば入賞圏（本部の見立て）。
          使いどころは制作の前ではなく<span className="font-semibold">納品のあと</span>です。作品を渡した先に「せっかくなので◯◯賞に出しませんか」と追加で伝え、受賞後の地元紙・表彰式・受賞マークの使い道まで添えます。
        </p>
      </div>

      {/* ── 絞り込み */}
      <form method="get" className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">都道府県（地元の賞）</span>
            <select name="pref" defaultValue={pref} className={`mt-1 ${selectClass}`}>
              <option value={ALL_PREFECTURES}>指定しない（全国の地方賞を全部）</option>
              {PREFECTURES.filter((p) => p !== "海外").map((p) => (
                <option key={p} value={p}>
                  {p}
                  {ownPrefectures.includes(p) ? "（自分の拠点）" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600">制作物の種類</span>
            <select name="cat" defaultValue={cat} className={`mt-1 ${selectClass}`}>
              <option value="">指定しない</option>
              {AWARD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600">範囲</span>
            <select name="range" defaultValue={range} className={`mt-1 ${selectClass}`}>
              {RANGE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-600 pb-2">
              <input
                type="checkbox"
                name="easyOnly"
                value="1"
                defaultChecked={easyOnly}
                className="h-4 w-4 rounded border-zinc-300"
              />
              狙える賞（◎○）だけ
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

      {/* ── 件数 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {rows.length}件（地方 {counts.REGIONAL}・全国 {counts.NATIONAL}
          {range === "all" ? `・国際 ${counts.INTERNATIONAL}` : ""}）・いま受付中 {counts.open}件
        </span>
        <span>正本: src/lib/ad-award/curated.ts（年1回、日程だけ更新）</span>
      </div>

      {/* ── 一覧 */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          該当する賞がありません。都道府県を「指定しない」にするか、範囲を広げてください。
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ a, w }) => {
            const tier = WIN_TIER_META[a.winTier];
            const scope = SCOPE_META[a.scope];
            const conf = CONFIDENCE_META[a.confidence];
            return (
              <li key={a.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${tier.badge}`}>
                    {tier.mark} {tier.label}
                  </span>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${windowBadge(w)}`}>
                    {w.label}
                  </span>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] ${scope.badge}`}>
                    {scope.label}
                    {a.region ? `・${a.region}` : ""}
                  </span>
                  {a.confidence !== "HIGH" && (
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] ${conf.badge}`}>
                      {conf.label}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-zinc-900">
                      {a.name}
                      {a.nameEn && a.nameEn !== a.name && (
                        <span className="ml-2 text-xs font-normal text-zinc-400">{a.nameEn}</span>
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500">主催: {a.organizer}</p>
                  </div>
                  <CopyPitchButton text={pitchText(a, w)} />
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {a.categories.map((c) => (
                    <span key={c} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
                      {c}
                    </span>
                  ))}
                </div>

                {a.pitchNote && (
                  <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-zinc-800 leading-relaxed">
                    <span className="font-semibold">先方へ伝える材料: </span>
                    {a.pitchNote}
                  </p>
                )}
                {a.difficultyNote && (
                  <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed">{a.difficultyNote}</p>
                )}

                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                  <div className="lg:col-span-2">
                    <dt className="text-zinc-500">応募期間（確認時の原文）</dt>
                    <dd className="font-medium text-zinc-900">
                      {a.entryPeriodRaw ?? "—"}
                      {a.verifiedYear && (
                        <span className="ml-1 font-normal text-zinc-400">{a.verifiedYear}年確認</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">応募料</dt>
                    <dd className="font-medium text-zinc-900">{a.feeRaw ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">発表・表彰</dt>
                    <dd className="font-medium text-zinc-900">
                      {a.ceremonyRaw ?? (a.announceMonth ? `${a.announceMonth}月頃` : "—")}
                    </dd>
                  </div>
                  {a.eligibility && (
                    <div className="sm:col-span-2 lg:col-span-4">
                      <dt className="text-zinc-500">応募できる人・作品</dt>
                      <dd className="font-medium text-zinc-900">{a.eligibility}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                    >
                      公式ページ
                    </a>
                  )}
                  {a.sourceUrl && a.sourceUrl !== a.url && (
                    <a
                      href={a.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600"
                    >
                      日程の出典
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
