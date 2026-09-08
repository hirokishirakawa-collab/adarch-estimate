"use client";

// TVer小口申込 — 5ステップの申込フォーム（1ページ・縦積み・右にサマリー）
//   金額は画面で仮計算し、確定はサーバー（lib/tver-order/service.ts）が正。
//   初期登録費は「初回のみ」＝画面では常に加算して見せ、2回目以降はサーバーが 0 にする（決済画面の額が正）。

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { MEDIA_FEE_FLOOR, MONTH_OPTIONS, SETUP_FEE_EXCL_TAX, SETUP_FEE_WAIVE_FROM, TVER_ORDER_PLANS, type OrderMonths, approx, quote, yen, type TverOrderAreaEstimate, type TverOrderPlanKey } from "@/lib/tver-order/plans";
import { TERMS, TERMS_TITLE, TERMS_VERSION } from "@/lib/tver-order/terms";
import { submitTverOrder, type OrderFormState } from "./actions";
import { Icon } from "./shared";
import { getAreaEstimate, getMunicipalities, submitMultiAreaConsult, type ConsultState } from "./area-actions";

type Muni = { code: string; name: string; population: number };

export function OrderForm(props: {
  from: string;
  senderCompany: string | null;
  prefs: string[];
  initialPref: string;
  initialMunis: Muni[];
  initialCity: string;
  initialEstimate: TverOrderAreaEstimate | null;
}) {
  const [pref, setPref] = useState(props.initialPref);
  const [munis, setMunis] = useState<Muni[]>(props.initialMunis);
  const [city, setCity] = useState(props.initialCity);
  const [est, setEst] = useState<TverOrderAreaEstimate | null>(props.initialEstimate);
  const [plan, setPlan] = useState<TverOrderPlanKey>("standard");
  const [months, setMonths] = useState<OrderMonths>(3);
  const [hasVideo, setHasVideo] = useState(true);
  const [payment, setPayment] = useState<"CARD" | "BANK_TRANSFER">("CARD");
  const [consultOpen, setConsultOpen] = useState(false);
  const [loading, startLoading] = useTransition();
  const [state, formAction, isPending] = useActionState<OrderFormState, FormData>(submitTverOrder, null);

  // 県が変わったら市の一覧と目安を取り直す
  const onPrefChange = (p: string) => {
    setPref(p);
    startLoading(async () => {
      const list = await getMunicipalities(p);
      setMunis(list);
      const first = list[0]?.code ?? "";
      setCity(first);
      setEst(first ? await getAreaEstimate(p, first) : null);
    });
  };
  const onCityChange = (c: string) => {
    setCity(c);
    startLoading(async () => setEst(await getAreaEstimate(pref, c)));
  };

  const planDef = TVER_ORDER_PLANS.find((p) => p.key === plan)!;
  const mediaFee = est?.byPlan[plan].mediaFee ?? planDef.floor;
  const q = useMemo(() => quote(mediaFee, true, months), [mediaFee, months]);
  const cityName = munis.find((m) => m.code === city)?.name ?? "";
  const areaLabel = `${pref} ${cityName}`;

  useEffect(() => {
    if (state?.error) document.getElementById("form-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  return (
    <>
      <nav className="progress" aria-label="申込ステップ">
        <a href="#step-1" aria-current="step"><b>1</b> エリア</a>
        <a href="#step-2"><b>2</b> プラン</a>
        <a href="#step-3"><b>3</b> 広告主</a>
        <a href="#step-4"><b>4</b> 契約</a>
        <a href="#step-5"><b>5</b> お支払い</a>
      </nav>
      <div className="order-layout">
        <main>
          <form id="order-form" action={formAction}>
            <input type="hidden" name="from" value={props.from} />
            <input type="hidden" name="prefName" value={pref} />
            <input type="hidden" name="municipalityCode" value={city} />
            <input type="hidden" name="months" value={months} />

            {/* ── 1 エリア */}
            <section className="step" id="step-1">
              <p className="eyebrow">01 / AREA</p>
              <h2><Icon name="pin" />配信する街を選ぶ</h2>
              <p className="lead">お店や事業のある市区町村へ。まずは1つの市区町村で始めます。</p>
              <div className="field-grid">
                <label className="field">
                  都道府県
                  <select value={pref} onChange={(e) => onPrefChange(e.target.value)}>
                    {props.prefs.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  市区町村
                  <select value={city} onChange={(e) => onCityChange(e.target.value)}>
                    {munis.map((m) => (
                      <option key={m.code} value={m.code}>{m.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="audience" aria-live="polite" style={{ opacity: loading ? 0.5 : 1 }}>
                <p><b>{cityName || "—"}</b>｜TVer視聴者</p>
                <p className="audience-number">
                  {est ? (
                    <>約{(est.viewers / 10_000).toFixed(1)}<span>万人</span></>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="small">{est ? `住民${(est.population / 10_000).toFixed(1)}万人` : ""}</p>
              </div>
              <div className="note">
                <strong>読み方</strong>
                <p>人数は公的統計とTVerの視聴率からの推計です。実際の視聴者数・配信結果とは異なる場合があります。</p>
              </div>
              <div className="note" style={{ marginTop: 12 }}>
                <strong>2つ以上の市区町村に配信したい方</strong>
                <p>
                  このお申込みは1市区町村ずつです。複数エリアや商圏まるごとの配信は、担当がエリアの組み合わせと料金の目安を個別にご案内します。
                  <button type="button" className="text-button" onClick={() => setConsultOpen((v) => !v)} style={{ marginLeft: 8 }}>
                    {consultOpen ? "閉じる" : "複数エリアで相談する →"}
                  </button>
                </p>
              </div>
              {consultOpen && <MultiAreaConsult from={props.from} senderCompany={props.senderCompany} />}
            </section>

            {/* ── 2 プラン */}
            <section className="step" id="step-2">
              <p className="eyebrow">02 / PLAN</p>
              <h2><Icon name="tv" />プランを選ぶ</h2>
              <p className="lead">届けたい規模に合わせて、3つから。</p>
              <fieldset className="plans">
                <legend className="sr-only">配信プラン</legend>
                {TVER_ORDER_PLANS.map((p) => {
                  const e = est?.byPlan[p.key];
                  return (
                    <label className="plan-card" key={p.key}>
                      <span className="plan-badge">{p.recommended && <span className="badge recommended">おすすめ</span>}</span>
                      <span className="plan-title">
                        <input type="radio" name="planKey" value={p.key} checked={plan === p.key} onChange={() => setPlan(p.key)} /> {p.name}
                      </span>
                      {p.key === "full" && <span className="plan-ribbon">商圏まるごと＝結果を出す基準</span>}
                      <span className="small">{p.lead}／住民の{p.perResidents}人に1人へ</span>
                      <strong className="price">{e ? yen(e.mediaFee) : "—"}</strong>
                      <span className="small">媒体費 / 月・税抜{e?.floored ? "（この市の最低額）" : ""}</span>
                      <span className="plan-stat">月の再生数の目安<strong>{e ? `${approx(e.impressions)}回` : "—"}</strong></span>
                      <span className="plan-stat">月に届く人数の目安<strong>{e ? `${approx(e.reach, 50)}人` : "—"}</strong><small>{e ? `${cityName}の住民の${e.pctResidents.toFixed(2)}%` : ""}</small></span>
                      {p.note && <small className="small" style={{ display: "block", marginTop: 6 }}>{p.note}</small>}
                    </label>
                  );
                })}
              </fieldset>
              <p className="plan-common">
                15秒CM ／ 市区町村単位 ／ 価格は市の人口で決まります（月額・最低{yen(MEDIA_FEE_FLOOR)}）
                <br />
                月次レポート1枚 ／ 配信設定・考査申請は本部
              </p>
              <fieldset className="choices choices-inline">
                <legend><Icon name="calendar" />契約期間</legend>
                {MONTH_OPTIONS.map((m) => (
                  <label key={m.months}>
                    <input type="radio" name="months_ui" value={m.months} checked={months === m.months} onChange={() => setMonths(m.months)} /> {m.label}
                    {m.recommended && <span className="badge recommended" style={{ marginLeft: 8 }}>おすすめ</span>}
                  </label>
                ))}
              </fieldset>
              <p className="small">{MONTH_OPTIONS.find((m) => m.months === months)?.note}。お支払いは月払い（毎月その月分）です。</p>
              <fieldset className="choices">
                <legend><Icon name="video" />配信用の動画</legend>
                <label><input type="radio" name="hasVideo" value="yes" checked={hasVideo} onChange={() => setHasVideo(true)} /> 15秒の動画があります</label>
                <label><input type="radio" name="hasVideo" value="no" checked={!hasVideo} onChange={() => setHasVideo(false)} /> ありません（制作を相談する）</label>
              </fieldset>
              {!hasVideo && (
                <div className="note">
                  <strong>ご案内</strong>
                  <p>制作は{props.senderCompany ? `担当の${props.senderCompany}` : "担当拠点"}がご案内します（制作費は別途）。申込はそのまま進められます。</p>
                </div>
              )}
            </section>

            {/* ── 3 広告主（決済前は最小限。法人番号・住所・代表者は決済後に進捗ページで） */}
            <section className="step" id="step-3">
              <p className="eyebrow">03 / ADVERTISER</p>
              <h2><Icon name="company" />会社とご連絡先</h2>
              <p className="lead">ここでは4項目だけ。法人番号・所在地・代表者名は、お支払い後の進捗ページでご記入いただきます（法人のお客様のみお申込みいただけます）。</p>
              <div className="field-grid">
                <label className="field">会社名<span className="required">必須</span><input type="text" name="advertiserName" required autoComplete="organization" /></label>
                <label className="field">ご担当者名<span className="required">必須</span><input type="text" name="contactName" required autoComplete="name" /></label>
                <label className="field">メール<span className="required">必須</span><input type="email" name="email" required autoComplete="email" /></label>
                <label className="field">電話<span className="required">必須</span><input type="tel" name="phone" required autoComplete="tel" /></label>
              </div>
            </section>

            {/* ── 4 契約 */}
            <section className="step" id="step-4">
              <p className="eyebrow">04 / AGREEMENT</p>
              <h2><Icon name="contract" />規約を確認して署名する</h2>
              <p className="lead">お申込みの前に、全文をご確認ください。</p>
              <div className="terms" tabIndex={0} aria-label="申込規約全文">
                <p className="small">{TERMS_TITLE} {TERMS_VERSION}</p>
                {TERMS.map((a) => (
                  <div key={a.no}>
                    <h3>第{a.no}条 {a.title}</h3>
                    {a.body.map((b, i) => (
                      <p key={i}>{i + 1}. {b}</p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="consents">
                <label><input type="checkbox" name="agreedTerms" required /> <span>申込規約に同意します</span></label>
                <label><input type="checkbox" name="agreedNoGuarantee" required /> <span>再生数・到達人数は目安であり、実際の配信結果とは異なる場合があることを理解しました</span></label>
                <label><input type="checkbox" name="agreedRefund" required /> <span>TVerの考査で出稿不可となった場合は全額返金となることを理解しました</span></label>
              </div>
              <label className="field">ご署名（お名前をフルネームで入力）<span className="required">必須</span><input type="text" name="signerName" required /></label>
              <p className="small">電子署名として、同意日時・IPアドレス・規約の版（{TERMS_VERSION}）を記録します。</p>
            </section>

            {/* ── 5 お支払い */}
            <section className="step" id="step-5">
              <p className="eyebrow">05 / PAYMENT</p>
              <h2><Icon name="payment" />内容を確認して、お支払い</h2>
              <p className="lead">お支払いは月払いです。いまお支払いいただくのは初月分（＋初回のみ初期登録費{yen(SETUP_FEE_EXCL_TAX)}・月額{yen(SETUP_FEE_WAIVE_FROM)}以上は無料）。2ヶ月目以降は配信開始日の応当日にその月分をご請求します。</p>
              <table className="order-table">
                <caption>お申込み内容（月払い）</caption>
                <thead><tr><th scope="col">項目</th><th scope="col">内容・金額</th></tr></thead>
                <tbody>
                  <tr><th scope="row">エリア</th><td>{areaLabel}</td></tr>
                  <tr><th scope="row">プラン・契約期間</th><td>{planDef.name}（15秒）・{months}ヶ月</td></tr>
                  <tr><th scope="row">月額（税抜）</th><td>{yen(q.mediaFeeExclTax)}</td></tr>
                  <tr><th scope="row">初期登録費（初回のみ・初月に加算）</th><td>{q.setupFeeExclTax ? yen(q.setupFeeExclTax) : `—（月額${yen(SETUP_FEE_WAIVE_FROM)}以上は無料）`}</td></tr>
                  <tr><th scope="row">初月の消費税（10%）</th><td>{yen(q.firstTax)}</td></tr>
                  <tr><th scope="row">2ヶ月目以降（税込・毎月）</th><td>{yen(q.monthlyInclTax)}</td></tr>
                  <tr><th scope="row">契約総額（税込・{months}ヶ月）</th><td>{yen(q.contractTotalInclTax)}</td></tr>
                </tbody>
                <tfoot>
                  <tr><th scope="row">初月のお支払い<span className="small">（税込）</span></th><td><strong className="total">{yen(q.firstInclTax)}</strong></td></tr>
                </tfoot>
              </table>
              <fieldset className="choices choices-inline" style={{ marginTop: 20 }}>
                <legend>お支払い方法</legend>
                <label><input type="radio" name="paymentMethod" value="CARD" checked={payment === "CARD"} onChange={() => setPayment("CARD")} /> クレジットカード（Square）</label>
                <label><input type="radio" name="paymentMethod" value="BANK_TRANSFER" checked={payment === "BANK_TRANSFER"} onChange={() => setPayment("BANK_TRANSFER")} /> 銀行振込（請求書払い）</label>
              </fieldset>
              {state?.error && (
                <p id="form-error" className="note" role="alert" style={{ marginTop: 16, color: "var(--pressed)" }}>
                  <strong>送信できませんでした</strong>
                  <br />
                  {state.error}
                  {state.token && (
                    <>
                      <br />
                      <a href={`/order/tver/${state.token}`}>進捗ページを開く →</a>
                    </>
                  )}
                </p>
              )}
              <button className="button payment-button" type="submit" disabled={isPending || !city}>
                {isPending ? "送信中…" : payment === "CARD" ? "初月分をカードで支払って申込を確定する" : "初月分の請求書を受け取って申込む"} <span aria-hidden="true">→</span>
              </button>
              <p className="payment-help">
                {payment === "CARD" ? (
                  <>Square の安全な決済画面に移動します<br />初月の決済完了で契約成立・2ヶ月目以降は毎月メールで決済リンクをお送りします</>
                ) : (
                  <>初月分の請求書（PDF）をメールでお送りします・お支払い期限は発行から7日<br />ご入金の確認で契約成立・2ヶ月目以降は毎月請求書をお送りします</>
                )}
              </p>
              <h3 className="flow-title">{payment === "CARD" ? "決済後" : "ご入金後"}の流れ</h3>
              <ol className="after-flow">
                <li><span>01</span><strong>初月の{payment === "CARD" ? "決済完了" : "入金確認"}</strong><small>契約成立・控えのメールが届きます</small></li>
                <li><span>02</span><strong>詳細記入 → 考査</strong><small>法人番号・所在地を3分で記入。本部が2〜5営業日で考査申請</small></li>
                <li><span>03</span><strong>動画の受付 → 配信開始</strong><small>動画受領から最短10営業日・{months}ヶ月配信</small></li>
                <li><span>04</span><strong><Icon name="report" />月次レポート</strong><small>配信結果を1枚でお届け</small></li>
              </ol>
            </section>
          </form>
        </main>
        <aside className="summary" aria-label="お申込み内容サマリー">
          <p className="summary-label">お申込み内容</p>
          <p className="summary-selection">
            <span>{areaLabel}</span>
            <br />
            <b>{planDef.name}・{months}ヶ月</b>
          </p>
          <div aria-live="polite" aria-atomic="true">
            <span className="small">初月のお支払い（税込）</span>
            <strong className="summary-total">{yen(q.firstInclTax)}</strong>
          </div>
          <p className="summary-detail small">月額{yen(q.mediaFeeExclTax)}{q.setupFeeExclTax ? "＋初期登録費（初回のみ）" : ""}＋消費税。2ヶ月目以降 {yen(q.monthlyInclTax)}／月</p>
          <a href="#step-5" className="summary-link">内容・お支払いを確認 <span aria-hidden="true">↓</span></a>
        </aside>
      </div>
    </>
  );
}

/** 複数エリアで相談したい（Step 1 の分岐） */
function MultiAreaConsult({ from, senderCompany }: { from: string; senderCompany: string | null }) {
  const [state, action, pending] = useActionState<ConsultState, FormData>(submitMultiAreaConsult, null);
  if (state?.success) {
    return (
      <div className="note" style={{ marginTop: 12 }}>
        <strong>受け付けました</strong>
        <p>{senderCompany ?? "Ad Arch株式会社"}から、エリアの組み合わせと料金の目安をご連絡します。確認メールをお送りしました。</p>
      </div>
    );
  }
  return (
    <form action={action} style={{ marginTop: 12, padding: "4px 0 8px", borderTop: "1px solid var(--line)" }}>
      <input type="hidden" name="from" value={from} />
      <div className="field-grid">
        <label className="field">会社名<span className="required">必須</span><input type="text" name="company" required /></label>
        <label className="field">お名前<span className="required">必須</span><input type="text" name="person" required /></label>
        <label className="field">メール<span className="required">必須</span><input type="email" name="email" required /></label>
        <label className="field">電話<span className="small">任意</span><input type="tel" name="phone" /></label>
      </div>
      <label className="field">配信したいエリア<span className="required">必須</span><textarea name="areas" rows={2} required placeholder="例: 高松市・丸亀市・坂出市、または香川県全域" /></label>
      <label className="field">ご予算の目安<span className="small">任意</span><input type="text" name="budget" placeholder="例: 月20万円くらい" /></label>
      {state?.error && <p className="small" style={{ color: "var(--pressed)" }}>{state.error}</p>}
      <button type="submit" className="button" disabled={pending} style={{ marginTop: 16 }}>
        {pending ? "送信中…" : "相談内容を送る"}
      </button>
      <p className="small">この相談では決済は発生しません。1市区町村で先に始める場合は、このまま下へ進んでください。</p>
    </form>
  );
}
