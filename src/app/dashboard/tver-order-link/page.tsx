// ==============================================================
// TVer申込リンク — 県・市を選んで、お客様に渡す申込URLをその場でコピーする（拠点向けの最短動線）
//   URL = /order/tver?from=<自社拠点ID>&pref=<県>&city=<市コード>
//   本部は「案内元の拠点」を選べる（お客様に渡すのは拠点の名義で）
//   価格はその市の3プラン（月額）を並べて見せる＝電話しながら答えられる
// ==============================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { Tv2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveArea } from "@/lib/packages/tver-area";
import { MONTH_OPTIONS, SETUP_FEE_EXCL_TAX, SETUP_FEE_WAIVE_FROM, TVER_ORDER_PLANS, approx, estimateForArea, quote, yen } from "@/lib/tver-order/plans";
import { AreaPicker } from "@/components/packages/area-picker";
import { CopyTextButton } from "@/components/packages/copy-text-button";
import { CompanyPicker } from "./company-picker";

export const dynamic = "force-dynamic";

type SP = { pref?: string; city?: string; company?: string };

export default async function TverOrderLinkPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const sp = await searchParams;
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true, groupCompanyId: true, groupCompany: { select: { id: true, name: true, ownerName: true, prefecture: true } } } });
  if (!me) redirect("/");
  const isAdmin = me.role === "ADMIN";

  // 案内元の拠点: 各社＝自社固定／本部＝選べる（既定は本部＝from無し）
  const companies = isAdmin ? await db.groupCompany.findMany({ where: { isActive: true }, select: { id: true, name: true, ownerName: true, prefecture: true }, orderBy: { name: "asc" } }) : [];
  const chosen = isAdmin ? companies.find((c) => c.id === sp.company) ?? null : me.groupCompany;

  const area = resolveArea({ pref: sp.pref, city: sp.city, fallbackPref: chosen?.prefecture ?? me.groupCompany?.prefecture ?? null });
  const est = area.city ? estimateForArea(area.pref, area.city) : null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const q = new URLSearchParams();
  if (chosen?.id) q.set("from", chosen.id);
  q.set("pref", area.pref);
  if (area.city) q.set("city", area.city);
  const url = `${proto}://${host}/order/tver?${q.toString()}`;
  const urlPlain = `${proto}://${host}/order/tver${chosen?.id ? `?from=${chosen.id}` : ""}`;

  const cityName = area.munis.find((m) => m.code === area.city)?.name ?? "";
  const std = est?.byPlan.standard;
  const mailText = est
    ? [
        `TVer（民放公式のテレビ配信サービス）で、${cityName}の方に絞って15秒CMを流す「エリア限定プラン」のご案内です。`,
        `月額の目安（税抜）: ライト ${yen(est.byPlan.light.mediaFee)}／スタンダード ${yen(est.byPlan.standard.mediaFee)}／フル ${yen(est.byPlan.full.mediaFee)}`,
        `例えばスタンダードなら、月に約${approx(std!.reach, 50)}人（${cityName}の住民の約${std!.pctResidents.toFixed(1)}%）に届く計算です（推計・目安）。`,
        `契約期間は3・6・12ヶ月から、お支払いは月払い（カードまたは銀行振込）。下のページで市・プランを選び、そのままお申込みいただけます。`,
        url,
      ].join("\n")
    : url;

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-[#EDF3FF] rounded-xl flex items-center justify-center">
          <Tv2 className="text-[#1E5BFF]" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">TVer申込リンク</h1>
          <p className="text-xs text-zinc-500">県と市を選んで、お客様に渡すURLをコピー。開いた先でお客様が申込〜お支払いまで完結します（契約・請求・考査・配信は本部）</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          {isAdmin ? (
            <CompanyPicker companies={companies} value={chosen?.id ?? ""} />
          ) : (
            <div className="text-xs text-zinc-600">
              <span className="block mb-1 font-semibold">案内元（商談中の代表）</span>
              <span className="inline-block px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg">{me.groupCompany ? `${me.groupCompany.name}（${me.groupCompany.ownerName}）` : "拠点が未設定＝本部名義になります"}</span>
            </div>
          )}
          <AreaPicker pref={area.pref} prefs={area.prefs} city={area.city} munis={area.munis} />
        </div>

        {est && (
          <div className="grid sm:grid-cols-3 gap-3">
            {TVER_ORDER_PLANS.map((p) => {
              const e = est.byPlan[p.key];
              const qq = quote(e.mediaFee, true, 3);
              return (
                <div key={p.key} className={`rounded-lg border p-4 ${p.recommended ? "border-[#1E5BFF] bg-[#EDF3FF]" : "border-zinc-200"}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    {p.name}
                    {p.recommended && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F19834] text-zinc-900">おすすめ</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500">{p.lead}・住民の{p.perResidents}人に1人へ</div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{yen(e.mediaFee)}<span className="text-xs font-normal text-zinc-500 ml-1">/月・税抜</span></div>
                  <div className="mt-1 text-xs text-zinc-600">月 約{approx(e.impressions)}再生・約{approx(e.reach, 50)}人（住民の{e.pctResidents.toFixed(2)}%）</div>
                  <div className="mt-1 text-[11px] text-zinc-500">初月 税込 {yen(qq.firstInclTax)}{qq.setupFeeExclTax ? `（初期登録費${yen(SETUP_FEE_EXCL_TAX)}込）` : `（初期登録費なし＝月額${yen(SETUP_FEE_WAIVE_FROM)}以上）`}・以降 {yen(qq.monthlyInclTax)}/月</div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-zinc-500">数字は推計の目安（保証しない）。契約期間は{MONTH_OPTIONS.map((m) => m.label).join("・")}・月払い。価格は市の人口で決まります。</p>

        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-zinc-700 mb-1">この市を選んだ状態で開くURL（お客様に渡す）</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[260px] text-xs bg-white border border-zinc-200 rounded px-2 py-1.5 break-all">{url}</code>
              <CopyTextButton text={url} label="URLをコピー" className="bg-white" />
              <a href={url} target="_blank" rel="noopener" className="text-[11px] font-bold text-zinc-600 underline underline-offset-2">開く ↗</a>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-700 mb-1">市を選ばせる汎用URL（案内元だけ付いた形）</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[260px] text-xs bg-white border border-zinc-200 rounded px-2 py-1.5 break-all">{urlPlain}</code>
              <CopyTextButton text={urlPlain} label="URLをコピー" className="bg-white" />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-700 mb-1">メール・LINEに貼る文（価格入り・URL付き）</div>
            <pre className="text-xs bg-white border border-zinc-200 rounded px-3 py-2 whitespace-pre-wrap text-zinc-700">{mailText}</pre>
            <div className="mt-2"><CopyTextButton text={mailText} label="文面をコピー" className="bg-white" /></div>
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          申込が入ると、案内元の拠点（{chosen ? chosen.name : "本部"}）に確定・入金・動画到着の通知が届きます。一覧は
          <Link href="/dashboard/packages/local-reach-tver" className="text-orange-700 underline mx-1">パッケージ「地域リーチ固定パッケージ」</Link>
          {isAdmin && <>／本部は<Link href="/dashboard/admin/tver-orders" className="text-orange-700 underline mx-1">TVer小口申込</Link></>}
        </div>
      </div>
    </div>
  );
}
