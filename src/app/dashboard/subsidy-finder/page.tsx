import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PREFECTURES } from "@/lib/constants/crm";
import { SUBSIDY_INDUSTRIES, EMPLOYEE_TIERS, FIT_META } from "@/lib/subsidy/options";
import type { AdCostFit } from "@/generated/prisma/client";

export const metadata = { title: "補助金ファインダー" };
export const dynamic = "force-dynamic";

// ----------------------------------------------------------------
// 表示ユーティリティ
// ----------------------------------------------------------------
function formatYen(value: bigint | null) {
  if (!value) return "—";
  const n = Number(value);
  if (n >= 100_000_000) return `${(n / 100_000_000).toLocaleString("ja-JP")}億円`;
  if (n >= 10_000) return `${(n / 10_000).toLocaleString("ja-JP")}万円`;
  return `${n.toLocaleString("ja-JP")}円`;
}

function daysLeft(end: Date | null): number | null {
  if (!end) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const FIT_ORDER: Record<AdCostFit, number> = {
  CONFIRMED: 0,
  LIKELY: 1,
  UNKNOWN: 2,
  EXCLUDED: 3,
};

export default async function SubsidyFinderPage({
  searchParams,
}: {
  searchParams: Promise<{
    pref?: string;
    industry?: string;
    employees?: string;
    includeUnknown?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const pref = params.pref ?? "";
  const industry = params.industry ?? "";
  const employees = params.employees ?? "";
  const includeUnknown = params.includeUnknown === "1";

  const fits: AdCostFit[] = includeUnknown
    ? ["CONFIRMED", "LIKELY", "UNKNOWN"]
    : ["CONFIRMED", "LIKELY"];

  const tier = EMPLOYEE_TIERS.find((t) => t.value === employees);

  const rows = await db.subsidy.findMany({
    where: {
      isActive: true,
      adCostFit: { in: fits },
      // 全国の制度は都道府県を選んでも常に残す
      ...(pref ? { targetAreas: { hasSome: [pref, "全国"] } } : {}),
      ...(industry ? { industry: { contains: industry } } : {}),
      ...(tier ? { targetEmployees: { in: tier.accepts } } : {}),
    },
    orderBy: { acceptanceEnd: "asc" },
    take: 200,
  });

  // ◎→○→△ の順、その中で締切が近い順
  const sorted = [...rows].sort((a, b) => {
    const byFit = FIT_ORDER[a.adCostFit] - FIT_ORDER[b.adCostFit];
    if (byFit !== 0) return byFit;
    return (a.acceptanceEnd?.getTime() ?? Infinity) - (b.acceptanceEnd?.getTime() ?? Infinity);
  });

  const lastSynced = rows.reduce<Date | null>((acc, r) => {
    if (!r.lastSyncedAt) return acc;
    return !acc || r.lastSyncedAt > acc ? r.lastSyncedAt : acc;
  }, null);

  const selectClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ── ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">💴</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">補助金ファインダー</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            クライアントの広告費に使える可能性がある制度を、地域・業種・規模から探します
          </p>
        </div>
      </div>

      {/* ── 使い方の前提（客先で誤断言しないための注意書き） */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold">この画面の読み方</p>
        <p className="mt-1">
          出典はデジタル庁の Jグランツ（電子申請に対応した制度）です。ここに載らない自治体独自の制度もあります。
          <br />
          <span className="font-semibold">◎</span> は公募要領を確認済み。
          <span className="font-semibold"> ○</span> と
          <span className="font-semibold"> △</span> は公開情報からの推定なので、
          <span className="font-semibold">客先で「使えます」と断言せず、公募要領のリンクを一緒に確認してください。</span>
        </p>
      </div>

      {/* ── 絞り込み */}
      <form method="get" className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">都道府県</span>
            <select name="pref" defaultValue={pref} className={`mt-1 ${selectClass}`}>
              <option value="">指定しない（全国＋各地）</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600">クライアントの業種</span>
            <select name="industry" defaultValue={industry} className={`mt-1 ${selectClass}`}>
              <option value="">指定しない</option>
              {SUBSIDY_INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600">従業員数</span>
            <select name="employees" defaultValue={employees} className={`mt-1 ${selectClass}`}>
              <option value="">指定しない</option>
              {EMPLOYEE_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-600 pb-2">
              <input
                type="checkbox"
                name="includeUnknown"
                value="1"
                defaultChecked={includeUnknown}
                className="h-4 w-4 rounded border-zinc-300"
              />
              △（要確認）も表示
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
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {sorted.length}件（募集中のみ）
          {rows.length >= 200 && "・上位200件を表示"}
        </span>
        <span>最終同期: {lastSynced ? formatDate(lastSynced) : "未同期"}</span>
      </div>

      {/* ── 一覧 */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          該当する制度がありません。条件を緩めるか、△も表示にしてください。
          <br />
          <span className="text-xs">
            1件も出ない場合は、まだ同期が走っていない可能性があります（日次: /api/cron/subsidy-sync）。
          </span>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((s) => {
            const meta = FIT_META[s.adCostFit];
            const left = daysLeft(s.acceptanceEnd);
            return (
              <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.badge}`}
                  >
                    {meta.mark} {meta.label}
                  </span>
                  {left !== null && (
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        left <= 14
                          ? "bg-red-50 text-red-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      締切まで{left}日
                    </span>
                  )}
                  {s.fitSource === "ai" && (
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
                      AI推定
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-bold text-zinc-900">{s.title}</h3>
                {s.institutionName && (
                  <p className="text-xs text-zinc-500">{s.institutionName}</p>
                )}

                {s.fitReason && (
                  <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{s.fitReason}</p>
                )}
                {s.fitEvidence && (
                  <p className="mt-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 leading-relaxed">
                    {s.fitSource === "curated" ? "注意点: " : "根拠: "}
                    {s.fitEvidence}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <dt className="text-zinc-500">上限額</dt>
                    <dd className="font-medium text-zinc-900">{formatYen(s.maxLimit)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">補助率</dt>
                    <dd className="font-medium text-zinc-900">{s.subsidyRate ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">締切</dt>
                    <dd className="font-medium text-zinc-900">{formatDate(s.acceptanceEnd)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">対象地域</dt>
                    <dd className="font-medium text-zinc-900">
                      {s.targetAreas.length > 0 ? s.targetAreas.join("・") : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {s.detailUrl && (
                    <a
                      href={s.detailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                    >
                      Jグランツで詳細を見る
                    </a>
                  )}
                  {s.guidelineUrl && (
                    <a
                      href={s.guidelineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600"
                    >
                      公募要領・公式情報
                    </a>
                  )}
                  {s.fitCheckedAt && (
                    <span className="text-zinc-400">
                      判定日 {formatDate(s.fitCheckedAt)}
                    </span>
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
