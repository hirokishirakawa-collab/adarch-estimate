// ==============================================================
// 業種×市の営業用LP  /lp/<slug>（お客様向け・ログイン不要）
//   文面（見出し・段落）はAIが create_landing_page で書いたもの。
//   数字（市のTVer視聴者数・標準プラン・到達人数）とパッケージの内容物は、表示のたびにOSから引く＝情報が古くならない・間違わない。
//   着地: ctaUrl（既定はTVer申込ページ）と、あれば公式LINE。
// ==============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { estimateArea } from "@/lib/packages/tver-area";
import { parseDeliverables } from "@/lib/packages/types";
import { HQ } from "@/lib/tver-order/terms";

export const dynamic = "force-dynamic";

type Section = { heading: string; body: string };

async function load(slug: string) {
  const p = await db.landingPage.findUnique({ where: { slug } });
  if (!p || p.status !== "PUBLISHED") return null;
  return p;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  return { title: p ? `${p.title} | Ad Arch` : "Ad Arch" };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();

  const [pkg, company] = await Promise.all([
    p.packageSlug ? db.salesPackage.findUnique({ where: { slug: p.packageSlug }, select: { name: true, tagline: true, deliverables: true, leadTime: true } }) : null,
    p.groupCompanyId ? db.groupCompany.findUnique({ where: { id: p.groupCompanyId }, select: { name: true, ownerName: true, prefecture: true } }) : null,
  ]);
  void db.landingPage.update({ where: { id: p.id }, data: { views: { increment: 1 } } }).catch(() => null);

  const est = p.showTverPlan && p.prefecture && p.cityCode ? estimateArea(p.prefecture, p.cityCode) : null;
  const sections = (Array.isArray(p.sections) ? p.sections : []) as Section[];
  const deliverables = pkg ? parseDeliverables(pkg.deliverables) : [];
  const fmt = (n: number) => Math.round(n).toLocaleString("ja-JP");

  return (
    <div className="page">
      <header className="brand">
        <b>
          Ad Arch<span>全国の広告グループ</span>
        </b>
        <small>{[p.prefecture, p.cityName].filter(Boolean).join("")}{p.industry ? ` ／ ${p.industry}の皆さまへ` : ""}</small>
      </header>

      <section className="hero">
        <p className="eyebrow">{p.cityName ? `${p.cityName} · ${p.industry ?? "Local"}` : p.industry ?? "Local Ads"}</p>
        <h1>{p.headline}</h1>
        {p.subheadline && <p className="sub">{p.subheadline}</p>}
        <a className="cta" href={p.ctaUrl}>{p.ctaLabel}</a>
        {p.lineUrl && <a className="cta cta-line" href={p.lineUrl}>LINEで相談する</a>}

        {est && (
          <>
            <div className="numbers">
              <div>
                <small>{est.plan.areaLabel} のTVer視聴者</small>
                <b>{fmt(est.plan.viewers)}<span>人</span></b>
              </div>
              <div>
                <small>標準プランで届く人数（3人に1人）</small>
                <b>{fmt(est.plan.reach)}<span>人</span></b>
              </div>
              <div>
                <small>月額の目安（税抜）</small>
                <b>¥{fmt(est.plan.monthly)}<span>〜</span></b>
              </div>
            </div>
            <p className="numbers-note">数字は市の人口とTVer視聴率からの推計・税抜。お申込みページで市区町村とプランを選ぶと、その場で確定額が出ます。</p>
          </>
        )}
      </section>

      {sections.map((s, i) => (
        <section className="sec" key={i}>
          <h2>{s.heading}</h2>
          <p>{s.body}</p>
        </section>
      ))}

      {pkg && (
        <div className="pkg">
          <h3>{pkg.name}{pkg.tagline ? ` — ${pkg.tagline}` : ""}</h3>
          {deliverables.length > 0 && (
            <ul>
              {deliverables.map((d, i) => (
                <li key={i}>{d.name}{d.qty ? `（${d.qty}${d.unit ?? ""}）` : ""}{d.spec ? ` ${d.spec}` : ""}</li>
              ))}
            </ul>
          )}
          {pkg.leadTime && <small>納期の目安: {pkg.leadTime}</small>}
        </div>
      )}

      <section className="close">
        <h2>まずは、地図で商圏を選ぶところから。</h2>
        <p>お申込みページでは市区町村とプランを選ぶだけ。契約・請求・配信の設定はAd Archが進めます。</p>
        <a className="cta" href={p.ctaUrl}>{p.ctaLabel}</a>
        {p.lineUrl && <a className="cta cta-line" href={p.lineUrl}>LINEで相談する</a>}
      </section>

      <p className="referrer">
        ご案内: {company ? `${company.name}${company.prefecture ? `（${company.prefecture}）` : ""}${company.ownerName ? `／ 代表 ${company.ownerName}` : ""}` : `${HQ.company}（TVer広告 正規代理店）`}
      </p>
      <footer>
        {HQ.company} ／ {HQ.email} ／ {HQ.phone}
      </footer>
    </div>
  );
}
