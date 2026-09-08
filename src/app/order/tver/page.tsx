// ==============================================================
// TVer広告 エリア限定プラン お申込み（お客様向け・ログイン不要）  /order/tver?from=<拠点ID>
//   ・エリア → プラン → 広告主 → 規約同意（電子署名） → お支払い（カード or 振込）を1ページで
//   ・?from= の拠点が「商談中の代表」として出る。無ければ本部
//   ・proxy.ts の matcher で order/ は除外＝認証を通らない
//   ・デザイン正本＝~/Desktop/05_媒体・提案資料/TVer小口申込_デザイン_2026-09/preview（アストラ生成）
// ==============================================================

import type { Metadata } from "next";
import { prefectureOptions, municipalitiesOf } from "@/lib/packages/tver-area";
import { estimateForArea } from "@/lib/tver-order/plans";
import { loadOrderSender } from "@/lib/tver-order/service";
import { OrderForm } from "./order-form";
import { BrandHeader, HeroArt, Icon, LegalFooter, Referrer } from "./shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TVer広告 エリア限定プラン お申込み｜Ad Arch",
  description: "民放公式のテレビ配信サービス（TVer）で、あなたの街へ15秒のCMを。エリアとプランを選んでWebで申込完了。",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ from?: string; pref?: string; city?: string }> };

export default async function TverOrderPage({ searchParams }: Props) {
  const { from, pref, city } = await searchParams;
  const sender = await loadOrderSender(from);
  const prefs = prefectureOptions();
  const initialPref = pref && prefs.includes(pref) ? pref : sender?.prefecture && prefs.includes(sender.prefecture) ? sender.prefecture : "東京都";
  const munis = municipalitiesOf(initialPref);
  const initialCity = city && munis.some((m) => m.code === city) ? city : munis[0]?.code ?? "";
  const initialEstimate = initialCity ? estimateForArea(initialPref, initialCity) : null;

  return (
    <div className="page">
      <BrandHeader from={sender?.id ?? null} />
      <Referrer sender={sender} />
      <section className="hero">
        <p className="eyebrow">AREA LIMITED / ORDER</p>
        <div className="hero-grid">
          <div>
            <h1>
              TVer広告
              <br />
              エリア限定プラン
              <br />
              お申込み
            </h1>
            <p className="lead">
              民放公式のテレビ配信サービス（TVer）
              <br />
              あなたの街へ、15秒のCMを。
            </p>
          </div>
          <HeroArt />
        </div>
        <ul className="benefits">
          <li><Icon name="clock" /><span>3分で申込完了</span></li>
          <li><Icon name="payment" /><span>カード決済・銀行振込（月払い）</span></li>
          <li><Icon name="calendar" /><span>最短10営業日で配信開始</span></li>
        </ul>
      </section>
      <OrderForm
        from={sender?.id ?? ""}
        senderCompany={sender?.company ?? null}
        prefs={prefs}
        initialPref={initialPref}
        initialMunis={munis}
        initialCity={initialCity}
        initialEstimate={initialEstimate}
      />
      <LegalFooter />
    </div>
  );
}
