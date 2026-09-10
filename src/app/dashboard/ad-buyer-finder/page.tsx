import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PREFECTURES } from "@/lib/constants/crm";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { listAdBuyers, parseSort } from "@/lib/ad-buyers/list";
import { AD_PLATFORMS, INDUSTRY_GROUP_LABEL } from "@/lib/ad-buyers/platforms";
import { AdBuyerSearchForm } from "@/components/ad-buyers/ad-buyer-search-form";
import { AdBuyerList } from "@/components/ad-buyers/ad-buyer-list";

export const metadata = { title: "広告出稿者ファインダー" };
export const dynamic = "force-dynamic";

// 全拠点が自分の商圏で使う画面（本部限定ではない）。閲覧範囲はリード管理と同じ＝グループ全社分
export default async function AdBuyerFinderPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string; city?: string; platform?: string; industry?: string; from?: string; to?: string; mine?: string; sort?: string; dir?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const viewer = await loadViewer(session.user.email);
  if (!viewer) redirect("/login");

  const p = await searchParams;
  const pref = p.pref ?? "";
  const city = p.city ?? "";
  const platform = p.platform ?? "";
  const industry = p.industry ?? "";
  const from = p.from ?? "";
  const to = p.to ?? "";
  const mine = p.mine === "1";

  const rows = await listAdBuyers(viewer, { prefecture: pref, city, platform, industry, from, to, mine, sort: parseSort(p.sort), dir: p.dir === "asc" ? "asc" : "desc" });
  const hasFilter = !!(pref || city || platform || industry || from || to || mine);

  const selectClass = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none";

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      {/* ── ヘッダー */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <span className="text-lg">📣</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">広告出稿者ファインダー</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            すでに有料媒体に載っている＝広告費を払っている地元の店を、県・市・業種で一覧にします。見つけた店はそのままリード管理・営業フォーム・郵送DMで使えます
          </p>
        </div>
      </div>

      {/* ── 読み方（固定の説明） */}
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 leading-relaxed">
        <p className="font-semibold text-zinc-900">この画面の読み方</p>
        <p className="mt-1">
          ホットペッパービューティーは実質、有料掲載のみ（無料枠は有料をやめた店の格下げ用）。
          <span className="font-semibold">掲載店＝今か過去に広告費を払っている店</span>です。
          食べログ等は無料枠があるため『中』の確度です。
          <br />
          判定は Google の店舗情報のURLと、自社サイトのトップページにある媒体リンクから機械的に行っています。
          根拠リンクを開けば掲載ページがそのまま見られます。同業や違う店が混ざっていたら「ファインダーから外す」で消してください（リード自体は残ります）。
        </p>
        <p className="mt-2 flex flex-wrap gap-1.5">
          {AD_PLATFORMS.map((pl) => (
            <span key={pl.key} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600">
              <span className="font-semibold text-zinc-800">{pl.short}</span>
              <span>{INDUSTRY_GROUP_LABEL[pl.industryGroup]}</span>
              <span className={pl.paidConfidence === "high" ? "text-orange-600 font-semibold" : "text-zinc-400"}>{pl.paidConfidence === "high" ? "確度: 高" : "確度: 中"}</span>
            </span>
          ))}
        </p>
      </div>

      {/* ── 探す */}
      <AdBuyerSearchForm prefectures={PREFECTURES as readonly string[]} defaultPrefecture={pref} defaultCity={city} />

      {/* ── 絞り込み（保存済みの一覧） */}
      <form method="get" className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-semibold text-zinc-900 mb-2">保存済みの一覧を絞り込む</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">都道府県</span>
            <select name="pref" defaultValue={pref} className={`mt-1 ${selectClass}`}>
              <option value="">全国</option>
              {PREFECTURES.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">市区町村</span>
            <input name="city" defaultValue={city} placeholder="例: 高松市" className={`mt-1 ${selectClass}`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">媒体</span>
            <select name="platform" defaultValue={platform} className={`mt-1 ${selectClass}`}>
              <option value="">すべて</option>
              {AD_PLATFORMS.map((pl) => (
                <option key={pl.key} value={pl.key}>{pl.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">業種</span>
            <input name="industry" defaultValue={industry} placeholder="例: 美容室" className={`mt-1 ${selectClass}`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">確認日 から</span>
            <input type="date" name="from" defaultValue={from} className={`mt-1 ${selectClass}`} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-600">確認日 まで</span>
            <input type="date" name="to" defaultValue={to} className={`mt-1 ${selectClass}`} />
          </label>
          <div className="col-span-2 sm:col-span-3 lg:col-span-7 flex items-end justify-end gap-3">
            <label className="flex items-center gap-1.5 text-xs text-zinc-600 pb-2.5 whitespace-nowrap">
              <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="h-4 w-4 rounded border-zinc-300" />
              自分の分だけ
            </label>
            <button type="submit" className="shrink-0 whitespace-nowrap rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">絞り込む</button>
          </div>
        </div>
        {hasFilter && (
          <div className="mt-2 text-right">
            <Link href="/dashboard/ad-buyer-finder" className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800">絞り込みを解除</Link>
          </div>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>{rows.length}件</span>
        <span>
          一覧は<Link href="/dashboard/leads/list" className="underline underline-offset-2">リード管理</Link>に保存済みの店です（同名・同住所は1件）
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          {hasFilter ? "条件に合う店がありません。絞り込みを緩めるか、上の「探す」で新しく探してください。" : "まず県と市と業種を選んで探してください。有料媒体の掲載を確認できた店だけがここに並びます。"}
        </div>
      ) : (
        <AdBuyerList rows={rows} />
      )}
    </div>
  );
}
