// TVer小口申込 — 申込ページと進捗ページで共有する部品（サーバー/クライアント両用・状態なし）
import { HQ } from "@/lib/tver-order/terms";
import type { OrderSender } from "@/lib/tver-order/service";

export const HQ_ADDRESS = "〒107-0062 東京都港区南青山2-15-5 FARO 1階";

export function BrandHeader({ from }: { from?: string | null }) {
  return (
    <header className="brand">
      <a href={from ? `/order/tver?from=${encodeURIComponent(from)}` : "/order/tver"} aria-label="Ad Arch">
        Ad Arch<span>全国24拠点の広告グループ</span>
      </a>
      <span className="brand-service">TVer広告 / エリア限定プラン</span>
    </header>
  );
}

/** 商談中の代表（案内元の拠点）。無ければ本部 */
export function Referrer({ sender }: { sender: OrderSender | null }) {
  if (!sender) {
    return (
      <p className="referrer">
        ご案内: {HQ.company}（TVer広告 正規代理店）　{HQ.email}　／　{HQ.phone}
      </p>
    );
  }
  return (
    <p className="referrer">
      ご案内・ご担当: <b style={{ color: "var(--ink)" }}>{sender.company}</b>
      {sender.prefecture ? `（${sender.prefecture}）` : ""}
      {sender.person ? `／ 代表 ${sender.person}` : ""}
      {sender.email ? (
        <>
          {" "}／ <a href={`mailto:${sender.email}`}>{sender.email}</a>
        </>
      ) : null}
      <span style={{ display: "block", fontSize: 11 }}>契約・請求・配信設定は Ad Arch株式会社（TVer広告 正規代理店）が行います。ご相談は上記の担当へどうぞ。</span>
    </p>
  );
}

export function LegalFooter() {
  return (
    <footer className="footer">
      <h2>事業者表示（特定商取引法）</h2>
      <p>
        {HQ.company}
        <br />
        <a href={`mailto:${HQ.email}`}>{HQ.email}</a> ／ <a href={`tel:${HQ.phone.replace(/-/g, "")}`}>{HQ.phone}</a>
        <br />
        所在地：{HQ_ADDRESS}
      </p>
      <p>
        販売価格：選択した市区町村・プランの媒体費（人口に応じて算出・画面に表示）＋初期登録費30,000円（初回のみ・月額20万円以上は無料）＋消費税。
        <br />
        支払時期：月払い。初月分はお申込み時（カード決済または請求書発行から7日以内の銀行振込）、2ヶ月目以降は配信開始日の各月応当日まで。
        <br />
        返金条件：TVerの考査で出稿不可となった場合は全額返金。その他は申込規約第7条による。
      </p>
      <div className="footer-bottom">
        <b>Ad Arch</b>
        <span>このページは招待制です。検索には表示されません</span>
      </div>
    </footer>
  );
}

const ICON_PATHS: Record<string, React.ReactNode> = {
  pin: (<><path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>),
  tv: (<><rect x="3" y="5" width="18" height="12" /><path d="M8 21h8m-4-4v4m-5-20 5 4 5-4" /></>),
  company: <path d="M4 22V3h12v19m0-13h5v13M1 22h22M8 7h4m-4 4h4m-4 4h4m-3 7v-3h3v3" />,
  contract: <path d="M14 2H4v20h16V8Zm0 0v6h6M8 12h8m-8 4h5m2 3 2-2" />,
  payment: (<><path d="m13 5 5-3 5 3H13Zm1 3v6m4-6v6m4-6v6m-9 3h10" /><rect x="1" y="10" width="11" height="10" /><path d="M1 14h11m-8 3h3" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" /><path d="M7 2v6m10-6v6M3 11h18m-13 5 3 3 5-5" /></>),
  video: (<><rect x="2" y="4" width="20" height="16" /><path d="m10 8 6 4-6 4Z" /></>),
  report: <path d="M14 2H4v20h16V8Zm0 0v6h6M8 18v-4m4 4v-7m4 7v-5" />,
};

/** 単色SVGアイコン（アストラ v2）。currentColor で親の文字色に従う */
export function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICON_PATHS[name]}
    </svg>
  );
}

/** 放映イメージ（テレビにTVer風プレーヤー・15秒CM・市の輪郭／スマホ・PC）。アストラ v2 */
export function HeroArt() {
  return (
    <figure className="broadcast">
      <svg className="hero-art" viewBox="0 0 540 350" role="img" aria-labelledby="broadcast-title broadcast-desc">
        <title id="broadcast-title">番組の途中に流れる15秒CMの放映イメージ</title>
        <desc id="broadcast-desc">テレビの青いプレーヤーに市の輪郭と「あなたの街に配信中」の帯。横にはスマートフォンとPC。画面と市の形は説明用のイメージです。</desc>
        <g fontFamily="IBM Plex Sans JP, sans-serif" fontWeight={400}>
          <path d="M20 40H494V285H20Z" fill="#EDF3FF" />
          <path d="M170 250v27h-45m130 0h-85m45-27v27" fill="none" stroke="#0B3CC1" strokeWidth={8} />
          <rect x="34" y="27" width="380" height="228" fill="#10265A" />
          <rect x="43" y="36" width="362" height="208" fill="#1E5BFF" />
          <path d="M43 36h362v32H43Z" fill="#0B3CC1" />
          <text x="57" y="58" fontSize={15} fill="white" fontWeight={600}>TVer</text>
          <text x="390" y="57" textAnchor="end" fontSize={12} fill="white">番組の途中の広告</text>
          <path d="m137 89 35-10 25 12 30-13 31 18 5 21 29 16-18 25 5 21-34 13-29-10-26 15-21-20-30-3-8-24-22-19Z" fill="#C8DAFF" stroke="white" strokeWidth={2} />
          <path d="m150 104 105 65m-74-78 18 90m-66-46 132-10" fill="none" stroke="white" strokeWidth={2} />
          <path d="M228 124c0 13-17 29-17 29s-17-16-17-29a17 17 0 0 1 34 0Z" fill="#0B3CC1" />
          <circle cx="211" cy="124" r="6" fill="white" />
          <rect x="55" y="78" width="69" height="27" fill="white" />
          <text x="89" y="97" textAnchor="middle" fontSize={15} fontWeight={600} fill="#0B3CC1">15秒CM</text>
          <rect x="43" y="185" width="362" height="32" fill="#0B3CC1" />
          <text x="224" y="207" textAnchor="middle" fontSize={18} fill="white" fontWeight={600}>あなたの街に配信中</text>
          <path d="M57 226v9m5-9v9" stroke="white" strokeWidth={3} />
          <path d="M75 231h251" stroke="#799EFF" strokeWidth={3} />
          <path d="M75 231h105" stroke="white" strokeWidth={3} />
          <text x="391" y="235" textAnchor="end" fontSize={11} fill="white">00:06 / 00:15</text>
          <rect x="425" y="127" width="69" height="127" fill="#10265A" />
          <rect x="431" y="136" width="57" height="107" fill="#1E5BFF" />
          <path d="m440 161 18-8 20 12-6 17 5 17-21 9-15-19Z" fill="#C8DAFF" />
          <path d="m454 173 12 8-12 8Z" fill="#0B3CC1" />
          <path d="M435 218h49" stroke="white" strokeWidth={3} />
          <rect x="332" y="233" width="153" height="82" fill="#10265A" />
          <rect x="339" y="240" width="139" height="66" fill="#1E5BFF" />
          <path d="m387 249 23-5 21 12-9 20-19 8-19-15Z" fill="#C8DAFF" />
          <path d="m403 256 13 9-13 8Z" fill="#0B3CC1" />
          <path d="M347 296h122" stroke="white" strokeWidth={3} />
          <path d="M322 315h173l10 9H312Z" fill="#0B3CC1" />
          <text x="34" y="311" fontSize={12} fill="#0B3CC1">CTV / CONNECTED TV</text>
        </g>
      </svg>
      <figcaption>
        テレビ・スマホ・PC すべてに届く<small>放映イメージ（画面・市の輪郭は模式図）</small>
      </figcaption>
    </figure>
  );
}
