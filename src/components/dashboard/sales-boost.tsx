import Link from "next/link";
import { Target, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { nextAnniversary } from "@/lib/anniversary/calc";
import { AD_AWARDS } from "@/lib/ad-award/curated";
import { entryWindow } from "@/lib/ad-award/calc";
import { toFullPrefecture } from "@/lib/constants/crm";

// ----------------------------------------------------------------
// ダッシュボード「今週の当たり先」＋「グループの受注・反応（匿名）」
// - 当たり先: ログインユーザーの加盟会社の県で、周年・入札・補助金・シグナルを集計
// - 匿名フィード: 結果ボタンから溜まる事例DB（SalesApproach）の受注・前向き返信を
//   会社名・投稿者名を出さずに流す（業種×県×方法のみ）
// メール送信・自動追いかけは行わない。OS内の表示のみ。
// ----------------------------------------------------------------

const METHOD_LABEL: Record<string, string> = {
  EMAIL: "メール",
  FORM: "フォーム",
  DM: "DM",
  PHONE: "電話",
  VISIT: "訪問",
  OTHER: "アプローチ",
};

function prefBase(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (t.startsWith("北海道")) return "北海道";
  return t.replace(/[都府県]$/, "");
}

// 匿名フィード用のエリア区分。県名だと1県1〜3社で誰の実績か特定できてしまうため、
// 東日本／西日本の2区分まで丸める（近畿以西＝西日本、それ以外＝東日本）。
const WEST_PREFS = new Set([
  "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
  "鳥取", "島根", "岡山", "広島", "山口",
  "徳島", "香川", "愛媛", "高知",
  "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄",
]);

function regionLabel(prefecture: string | null): string | null {
  if (!prefecture) return null;
  const base = prefBase(prefecture);
  if (!base) return null;
  return WEST_PREFS.has(base) ? "西日本" : "東日本";
}

export async function SalesBoost({ userEmail }: { userEmail: string }) {
  const user = await db.user.findUnique({
    where: { email: userEmail },
    select: { role: true, groupCompany: { select: { prefecture: true } } },
  });
  // 本部(ADMIN)は特定の県ではなく全国合計で見る
  const isAdmin = user?.role === "ADMIN";
  const pref = !isAdmin ? (user?.groupCompany?.prefecture ?? null) : null;
  const base = pref ? prefBase(pref) : null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 対象範囲: 加盟店=自分の県 / 本部(ADMIN)=全国
  const scoped = isAdmin || base !== null;
  const prefFilter = base ? { prefecture: { contains: base } } : {};
  const tenderPrefFilter = base ? { prefectureName: { contains: base } } : {};

  const [foundedLeads, tenderCount, subsidyCount, signalCount, wins] = await Promise.all([
    scoped
      ? db.lead.findMany({
          where: { ...prefFilter, foundedYear: { not: null } },
          select: { foundedYear: true, foundedMonth: true },
        })
      : Promise.resolve([]),
    scoped
      ? db.tender.count({
          where: { fit: "MATCH", ...tenderPrefFilter, expiresAt: { gte: now } },
        })
      : Promise.resolve(0),
    db.subsidy.count({
      where: {
        isActive: true,
        adCostFit: { in: ["CONFIRMED", "LIKELY"] },
        ...(pref ? { targetAreas: { hasSome: [pref, "全国"] } } : {}),
      },
    }),
    scoped
      ? db.lead.count({ where: { ...prefFilter, signalAt: { gte: weekAgo } } })
      : Promise.resolve(0),
    db.salesApproach.findMany({
      // 直近90日のみ。古い実績を「最新」のように見せない
      where: {
        result: { in: ["DEAL", "REPLIED_OK"] },
        createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        industry: true,
        method: true,
        result: true,
        createdAt: true,
        lead: { select: { prefecture: true } },
      },
    }),
  ]);

  // 3ヶ月以内に周年を迎える会社（目安。除外・詳細条件は周年ファインダー側が正）
  const annivCount = foundedLeads.filter((l) => {
    const a = nextAnniversary(l.foundedYear as number, l.foundedMonth ?? null, now);
    return a !== null && a.monthsAway <= 3;
  }).length;

  // いま受付中の広告賞（自分の県の地方賞＋全国。本部は全国の地方賞も含む）。正本はコード内なのでDB問い合わせ不要
  const fullPref = pref ? toFullPrefecture(pref) : null;
  const awardOpenCount = AD_AWARDS.filter((a) => {
    if (a.scope === "INTERNATIONAL") return false;
    if (a.scope === "REGIONAL" && fullPref && !a.prefectures.includes(fullPref)) return false;
    return entryWindow(a, now).status === "OPEN";
  }).length;

  const targets = scoped
    ? [
        { label: "3ヶ月以内に周年", count: annivCount, href: "/dashboard/anniversary-finder", hint: "節目の年は「地元で目立つ」が刺さります" },
        { label: "いま応募できる広告賞", count: awardOpenCount, href: "/dashboard/award-finder", hint: "制作物の箔付け（受賞狙い）のご提案に" },
        { label: "入札（○判定・受付中）", count: tenderCount, href: "/dashboard/tender-finder", hint: "広告・映像・印刷の公的案件" },
        { label: "広告費に使える補助金", count: subsidyCount, href: "/dashboard/subsidy-finder", hint: "クライアントの財源のご提案に" },
        { label: "今週シグナルが立った会社", count: signalCount, href: "/dashboard/leads/list", hint: "買う気配が立った直後に当たる" },
      ]
    : [];


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── 今週の当たり先（自分の県） */}
      {targets.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold text-zinc-800">今週の当たり先（{isAdmin ? "全国" : pref}）</p>
          </div>
          <div className="space-y-1.5">
            {targets.map((t) => (
              <Link
                key={t.href + t.label}
                href={t.href}
                className="flex items-center gap-3 bg-white/70 rounded-lg px-3 py-2 border border-emerald-100 hover:bg-white transition-colors"
              >
                <span className="text-lg font-black text-emerald-600 w-10 text-right flex-shrink-0">
                  {t.count}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-zinc-800">{t.label}</span>
                  <span className="block text-[10px] text-zinc-500">{t.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── グループの受注・反応（匿名フィード・直近90日） */}
      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-bold text-zinc-800">グループの受注・反応</p>
          <span className="text-[10px] text-zinc-400">匿名・直近90日</span>
        </div>
        {wins.length === 0 ? (
          <div className="bg-white/70 rounded-lg px-4 py-4 border border-amber-100 text-center">
            <p className="text-xs text-zinc-600">
              直近90日の受注・前向き返信はまだ登録されていません。
            </p>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              送った先から返事が来たら
              <Link href="/dashboard/leads/awaiting" className="font-bold text-amber-700 underline mx-0.5">
                返事待ち一覧
              </Link>
              の結果ボタンを1クリック — それだけでここに流れ、グループ全体の営業の精度が上がります
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-1.5">
            {wins.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-2 border border-amber-100"
              >
                <span
                  className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    w.result === "DEAL"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-teal-100 text-teal-700"
                  }`}
                >
                  {w.result === "DEAL" ? "受注 🎉" : "前向き返信"}
                </span>
                <span className="min-w-0 text-xs text-zinc-700 truncate">
                  {regionLabel(w.lead?.prefecture ?? null) ? `${regionLabel(w.lead?.prefecture ?? null)}・` : ""}
                  {w.industry || "業種不明"}に{METHOD_LABEL[w.method] ?? w.method}
                </span>
                <span className="ml-auto flex-shrink-0 text-[10px] text-zinc-400">
                  {new Date(w.createdAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-2">
            送った先の結果ボタンから自動で集まっています。文面は
            <Link href="/dashboard/sales-approaches" className="text-amber-700 underline">
              アプローチ事例集
            </Link>
            へ
          </p>
          </>
        )}
      </div>
    </div>
  );
}
