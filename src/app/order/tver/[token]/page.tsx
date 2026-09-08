// ==============================================================
// TVer小口申込 — 進捗ページ（お客様向け・ログイン不要）  /order/tver/<token>
//   決済待ち → 決済完了（詳細記入） → 考査中 → 動画受付 → 配信中 → レポート
//   token は推測不能な長い文字列＝知っている人（広告主・担当拠点・本部）だけが開ける
// ==============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AD_SECONDS, orderNumberLabel, planByKey, quote, yen } from "@/lib/tver-order/plans";
import { TERMS, TERMS_TITLE } from "@/lib/tver-order/terms";
import { TVER_ORDER_STATUS_LABEL, loadOrderSender, progressIndex } from "@/lib/tver-order/service";
import { BrandHeader, LegalFooter, Referrer } from "../shared";
import { DetailsForm, MaterialForm, PayButton } from "./status-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "お申込みの進捗｜Ad Arch", robots: { index: false, follow: false } };

const fmtD = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(d);
const fmtDT = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string; invoiced?: string }> };

export default async function TverOrderStatusPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { paid, invoiced } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) notFound();
  const o = await db.tverOrder.findUnique({ where: { token }, include: { invoices: { orderBy: { seq: "asc" } } } });
  if (!o) notFound();
  const sender = await loadOrderSender(o.groupCompanyId);
  const no = orderNumberLabel(o.number, o.createdAt);
  const plan = planByKey(o.planKey);
  const q = quote(o.mediaFeeExclTax, o.setupFeeExclTax > 0, o.months);
  const first = o.invoices.find((i) => i.seq === 1);
  const unpaidCard = o.invoices.find((i) => i.status === "UNPAID" && i.method === "CARD");
  const idx = progressIndex(o.status);
  const steps = [o.paymentMethod === "BANK_TRANSFER" ? "入金確認" : "決済完了", "考査", "動画受付", "配信中", "レポート"];
  const detailsDone = !!o.detailsCompletedAt;
  const canMaterial = !!o.paidAt && ["PAID", "REVIEWING", "MATERIAL_WAITING", "MATERIAL_RECEIVED"].includes(o.status);

  // ── 状態ごとの「次にしていただくこと」
  let lead = "";
  let next: React.ReactNode = null;
  if (o.status === "AWAITING_PAYMENT") {
    if (o.paymentMethod === "BANK_TRANSFER") {
      lead = first?.mfBillingId ? `初月の請求書（${first.mfBillingNumber ?? ""}）をメールでお送りしました。ご入金の確認をもって契約が成立します。` : "初月の請求書は本部より1営業日以内にメールでお送りします。";
      next = (
        <div className="note">
          <strong>お振込のお願い</strong>
          <p>初月分 税込 {yen(q.firstInclTax)} を請求書記載の口座へお振込みください（期限 {first ? fmtD(first.dueDate) : "発行から7日"}・振込手数料はご負担ください）。ご入金を確認しましたら、このページとメールでお知らせします。</p>
        </div>
      );
    } else {
      lead = paid === "1" ? "決済の確認を待っています。数十秒後にこのページを再読み込みしてください。" : "初月のお支払いがまだ完了していません。";
      next = <PayButton token={token} label={`初月分 ${yen(q.firstInclTax)} をカードで支払う`} />;
    }
  } else if (o.paidAt && !detailsDone) {
    lead = "お支払いありがとうございます。TVerの業態考査に必要な3項目をご記入ください（3分）。";
    next = <DetailsForm token={token} />;
  } else if (o.status === "PAID" || o.status === "REVIEWING") {
    lead = o.status === "REVIEWING" ? "本部がTVerへ業態考査を申請しました（2〜5営業日）。結果はメールでお知らせします。" : "詳細のご記入ありがとうございます。本部がTVerへ業態考査を申請します（2〜5営業日）。";
    next = canMaterial ? (
      <>
        <p className="small" style={{ marginBottom: 8 }}>動画がすでにお手元にあれば、先にお送りいただけます。</p>
        <MaterialForm token={token} current={o.materialUrl} />
      </>
    ) : null;
  } else if (o.status === "MATERIAL_WAITING") {
    lead = "考査が通りました。15秒の動画をアップロード、または共有URLをご入力ください。受領から最短10営業日で配信を開始します。";
    next = <MaterialForm token={token} current={o.materialUrl} />;
  } else if (o.status === "MATERIAL_RECEIVED") {
    lead = "動画を受け取りました。本部で規定チェックと入稿を進めています。配信開始日はメールでお知らせします。";
    next = <MaterialForm token={token} current={o.materialUrl} replace />;
  } else if (o.status === "LIVE") {
    lead = `配信中です${o.liveStartDate ? `（${fmtD(o.liveStartDate)} 〜 ${o.liveEndDate ? fmtD(o.liveEndDate) : `${o.months}ヶ月`}）` : ""}。終了後に月次レポートをお送りします。`;
  } else if (o.status === "COMPLETED") {
    lead = "配信が終了しました。ご利用ありがとうございました。";
    next = o.reportUrl ? (
      <a className="button" href={o.reportUrl} target="_blank" rel="noopener">月次レポートを開く ↗</a>
    ) : (
      <p className="small">月次レポートは本部よりメールでお送りします。</p>
    );
  } else if (o.status === "REFUNDED") {
    lead = "考査の結果、今回は出稿ができませんでした。お支払いいただいた料金は全額返金の手続きを行いました。";
  } else if (o.status === "CANCELLED") {
    lead = "このお申込みは取り下げられています。";
  }

  return (
    <div className="page">
      <BrandHeader from={sender?.id ?? null} />
      <Referrer sender={sender} />
      <main>
        <p className="eyebrow" style={{ marginTop: 28 }}>ORDER STATUS</p>
        <div className="status-heading">
          <h1>
            お申込み
            <br />
            No. {no}
          </h1>
          <span className="badge">{TVER_ORDER_STATUS_LABEL[o.status]}</span>
        </div>
        <p className="lead">{o.advertiserName}　{o.contactName} 様</p>
        {invoiced === "1" && o.status === "AWAITING_PAYMENT" && (
          <div className="note" style={{ marginTop: 16 }}>
            <strong>お申込みを受け付けました</strong>
            <p>請求書をメールでお送りします。ご入金の確認をもって契約が成立します。</p>
          </div>
        )}
        <ol className="status-progress">
          {steps.map((label, i) => (
            <li key={label} className={i <= idx ? "done" : undefined} aria-current={i === idx + 1 || (i === idx && idx === 4) ? "step" : undefined}>
              {i <= idx ? "✓" : i === idx + 1 ? "●" : String(i + 1).padStart(2, "0")}
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <section className="next-action">
          <p className="eyebrow">YOUR NEXT STEP</p>
          <h2>次にしていただくこと</h2>
          <p className="lead">{lead}</p>
          {o.customerNote && (
            <div className="note">
              <strong>本部からのご連絡</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{o.customerNote}</p>
            </div>
          )}
          {next}
        </section>

        {unpaidCard && o.status !== "AWAITING_PAYMENT" && (
          <section className="next-action" style={{ marginTop: 0 }}>
            <p className="eyebrow">PAYMENT</p>
            <h2>{unpaidCard.seq}ヶ月目のお支払い</h2>
            <p className="lead">税込 {yen(unpaidCard.amountInclTax)}　期限 {fmtD(unpaidCard.dueDate)}</p>
            <PayButton token={token} label={`${unpaidCard.seq}ヶ月目分をカードで支払う`} />
          </section>
        )}

        <section className="section">
          <table className="order-table">
            <caption>お支払い（月払い・{o.months}ヶ月）</caption>
            <thead><tr><th scope="col">月</th><th scope="col">金額（税込）・状況</th></tr></thead>
            <tbody>
              {o.invoices.map((i) => (
                <tr key={i.id}>
                  <th scope="row">{i.seq}ヶ月目{i.includesSetupFee ? "（初期登録費込み）" : ""}</th>
                  <td>
                    {yen(i.amountInclTax)}　
                    {i.status === "PAID" ? `✓ ${i.paidAt ? fmtD(i.paidAt) : ""} 入金確認` : i.status === "CANCELLED" ? "取消" : `期限 ${fmtD(i.dueDate)}・お支払い待ち`}
                    {i.status === "UNPAID" && i.method === "BANK_TRANSFER" && i.mfBillingNumber ? `（請求書 ${i.mfBillingNumber}）` : ""}
                  </td>
                </tr>
              ))}
              {o.invoices.length < o.months && (
                <tr><th scope="row">{o.invoices.length + 1}〜{o.months}ヶ月目</th><td>{yen(q.monthlyInclTax)} ／月　配信開始日の応当日にその月分をご請求します</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="section">
          <table className="order-table">
            <caption>お申込み内容</caption>
            <thead><tr><th scope="col">項目</th><th scope="col">内容・金額</th></tr></thead>
            <tbody>
              <tr><th scope="row">エリア</th><td>{o.prefName} {o.areaLabel}</td></tr>
              <tr><th scope="row">プラン・契約期間</th><td>{plan?.name ?? o.planKey}（{AD_SECONDS}秒）・{o.months}ヶ月・月払い</td></tr>
              <tr><th scope="row">再生数の目安</th><td>月 約{o.estImpressions.toLocaleString("ja-JP")}回（推計・保証しない）</td></tr>
              <tr><th scope="row">動画</th><td>{o.hasVideo ? "お客様がご用意（15秒）" : "なし（制作は担当がご案内）"}</td></tr>
              <tr><th scope="row">月額（税抜）</th><td>{yen(q.mediaFeeExclTax)}</td></tr>
              <tr><th scope="row">初期登録費（初回のみ）</th><td>{q.setupFeeExclTax ? yen(q.setupFeeExclTax) : "—"}</td></tr>
              <tr><th scope="row">お支払い方法</th><td>{o.paymentMethod === "BANK_TRANSFER" ? "銀行振込（毎月請求書）" : "クレジットカード（毎月決済リンク）"}{o.paidAt ? `　／　初月 ${fmtDT(o.paidAt)} 確認済み` : ""}</td></tr>
            </tbody>
            <tfoot>
              <tr><th scope="row">初月のお支払い<span className="small">（税込）</span></th><td><strong className="total">{yen(q.firstInclTax)}</strong><span className="small" style={{ display: "block" }}>2ヶ月目以降 {yen(q.monthlyInclTax)}／月・契約総額 {yen(q.contractTotalInclTax)}</span></td></tr>
            </tfoot>
          </table>
          {detailsDone && (
            <p className="small" style={{ marginTop: 12 }}>
              法人番号 {o.corporateNumber}　／　{o.postalCode ? `〒${o.postalCode} ` : ""}{o.address}　／　代表者 {o.representativeName}
              {o.industry ? `　／　${o.industry}` : ""}
            </p>
          )}
        </section>

        <section className="section">
          <details>
            <summary className="text-link" style={{ cursor: "pointer" }}>
              契約内容（{TERMS_TITLE} {o.termsVersion}）を確認する
            </summary>
            <div className="note" style={{ marginTop: 12 }}>
              <strong>電子的な同意の記録</strong>
              <p>
                {o.signerName} 様が {fmtDT(o.agreedAt)} に同意（規約 {o.termsVersion}{o.agreedIp ? `・IP ${o.agreedIp}` : ""}）。
                {o.paidAt ? `初月の${o.paymentMethod === "BANK_TRANSFER" ? "入金確認" : "決済完了"} ${fmtDT(o.paidAt)} をもって契約が成立しました。` : "初月のお支払いの確認をもって契約が成立します。"}
              </p>
            </div>
            <div className="terms" style={{ marginTop: 12, maxHeight: "none" }}>
              {TERMS.map((a) => (
                <div key={a.no}>
                  <h3>第{a.no}条 {a.title}</h3>
                  {a.body.map((b, i) => (
                    <p key={i}>{i + 1}. {b}</p>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
