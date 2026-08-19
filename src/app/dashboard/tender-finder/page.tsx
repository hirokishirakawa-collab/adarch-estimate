import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PREFECTURES, toFullPrefecture } from "@/lib/constants/crm";
import {
  TENDER_FIT_META,
  WORK_TYPE_META,
  WORK_TYPE_OPTIONS,
  ALL_PREFECTURES,
} from "@/lib/tender/options";
import type { Prisma, TenderWorkType } from "@/generated/prisma/client";

export const metadata = { title: "入札ファインダー" };
export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function daysLeft(end: Date | null): number | null {
  if (!end) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

/** ログイン中のユーザーの担当県（加盟企業のプロフィールから引く） */
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

export default async function TenderFinderPage({
  searchParams,
}: {
  searchParams: Promise<{
    pref?: string;
    work?: string;
    scope?: string;
    includeMaybe?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const ownPrefectures = await resolveOwnPrefectures(session.user.email);

  // 未指定なら自分の県を初期表示にする（地元の案件が最優先のため）
  const pref = params.pref ?? ownPrefectures[0] ?? ALL_PREFECTURES;
  const work = params.work ?? "";
  // 発注者の絞り込み: "" =すべて / "municipal"=市区町村のみ / "local"=自治体（都道府県＋市区町村）
  const scope = params.scope ?? "";
  const includeMaybe = params.includeMaybe === "1";

  const where: Prisma.TenderWhereInput = {
    fit: includeMaybe ? { in: ["MATCH", "MAYBE"] } : { equals: "MATCH" },
    // 判定が済んでいないものは出さない（未判定＝ノイズがそのまま並ぶため）
    fitCheckedAt: { not: null },
    // 期限切れを落とす。日付が公告に無いものは公告日+45日で切っている（推定）
    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    ...(pref !== ALL_PREFECTURES ? { prefectureName: pref } : {}),
    ...(work ? { workType: work as TenderWorkType } : {}),
    ...(scope === "municipal" ? { ordererType: "MUNICIPAL" as const } : {}),
    ...(scope === "local" ? { ordererType: { in: ["MUNICIPAL", "PREFECTURAL"] as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    db.tender.findMany({
      where,
      // 入札は鮮度が命。公告日の新しい順に並べる
      orderBy: [{ cftIssueDate: "desc" }, { createdAt: "desc" }],
      take: LIST_LIMIT,
    }),
    db.tender.count({ where }),
  ]);

  const lastSynced = await db.tender.findFirst({
    where: { lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: "desc" },
    select: { lastSyncedAt: true },
  });

  const selectClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ── ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">🏛️</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">入札ファインダー</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            全国の自治体・官公庁が出した入札公告から、動画・広告・印刷・イベントの仕事だけを拾います
          </p>
        </div>
      </div>

      {/* ── 使い方の前提 */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900 leading-relaxed">
        <p className="font-semibold">この画面の読み方</p>
        <p className="mt-1">
          出典は中小企業庁の官公需情報ポータルサイトです。各自治体がホームページに載せた公告を集めたもので、
          <span className="font-semibold">全ての案件を網羅しているわけではありません</span>。
          <br />
          仕分けは AI の推定です。応札前に必ず公告本文と仕様書を読んでください。
          <span className="font-semibold">「入札参加資格が必要」の表示がある案件は、名簿登録が済んでいないと参加できません。</span>
        </p>
      </div>

      {/* ── 絞り込み */}
      <form method="get" className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">
              都道府県
              {ownPrefectures.length > 0 && (
                <span className="ml-1 text-emerald-600">（初期表示: {ownPrefectures[0]}）</span>
              )}
            </span>
            <select name="pref" defaultValue={pref} className={`mt-1 ${selectClass}`}>
              <option value={ALL_PREFECTURES}>全国</option>
              {PREFECTURES.filter((p) => p !== "海外").map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600">仕事の種類</span>
            <select name="work" defaultValue={work} className={`mt-1 ${selectClass}`}>
              <option value="">すべて</option>
              {WORK_TYPE_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {WORK_TYPE_META[w].label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600">発注者</span>
            <select name="scope" defaultValue={scope} className={`mt-1 ${selectClass}`}>
              <option value="">すべて（国の機関も含む）</option>
              <option value="local">自治体のみ（都道府県＋市区町村）</option>
              <option value="municipal">市区町村のみ</option>
            </select>
          </label>

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-600 pb-2">
              <input
                type="checkbox"
                name="includeMaybe"
                value="1"
                defaultChecked={includeMaybe}
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
          {total}件（募集中のみ）
          {total > LIST_LIMIT && `・新しい${LIST_LIMIT}件を表示`}
        </span>
        <span>最終同期: {lastSynced?.lastSyncedAt ? formatDate(lastSynced.lastSyncedAt) : "未同期"}</span>
      </div>

      {/* ── 一覧 */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          該当する案件がありません。都道府県を「全国」にするか、△も表示にしてください。
          <br />
          <span className="text-xs">
            1件も出ない場合は、まだ同期が走っていない可能性があります（日次: /api/cron/tender-sync）。
          </span>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => {
            const meta = TENDER_FIT_META[t.fit];
            const workMeta = t.workType ? WORK_TYPE_META[t.workType] : null;
            const left = daysLeft(t.openingDate ?? t.submissionDate);
            return (
              <li key={t.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.badge}`}
                  >
                    {meta.mark} {meta.label}
                  </span>
                  {workMeta && (
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${workMeta.badge}`}>
                      {workMeta.label}
                    </span>
                  )}
                  {t.ordererType !== "OTHER" && (
                    <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      {t.ordererType === "MUNICIPAL" ? "市区町村" : "都道府県"}
                    </span>
                  )}
                  {t.procedureType && (
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                      {t.procedureType}
                    </span>
                  )}
                  {left !== null && left >= 0 && (
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        left <= 7 ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      開札まで{left}日
                    </span>
                  )}
                  {t.needsQualification && (
                    <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      入札参加資格が必要
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-bold text-zinc-900">{t.projectName}</h3>
                <p className="text-xs text-zinc-500">
                  {[t.organizationName, t.prefectureName && t.cityName ? null : t.prefectureName]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </p>

                {t.fitReason && (
                  <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{t.fitReason}</p>
                )}
                {t.fitEvidence && (
                  <p className="mt-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 leading-relaxed">
                    根拠: {t.fitEvidence}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <dt className="text-zinc-500">公告日</dt>
                    <dd className="font-medium text-zinc-900">{formatDate(t.cftIssueDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">入札開始日</dt>
                    <dd className="font-medium text-zinc-900">{formatDate(t.submissionDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">開札日</dt>
                    <dd className="font-medium text-zinc-900">{formatDate(t.openingDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">区分</dt>
                    <dd className="font-medium text-zinc-900">{t.category ?? "—"}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {t.documentUrl && (
                    <a
                      href={t.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                    >
                      公告を開く{t.fileType ? `（${t.fileType.toUpperCase()}）` : ""}
                    </a>
                  )}
                  {t.attachmentUrls.slice(0, 3).map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600"
                    >
                      添付{i + 1}
                    </a>
                  ))}
                  <span className="text-zinc-400">AI推定</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
