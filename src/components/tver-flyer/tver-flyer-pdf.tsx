// サーバー専用 — @react-pdf/renderer は Node.js でのみ動作
// 本部チラシ制作サポート: 「○○市を、まるごと。」A4縦1枚（クライアントに渡せる体裁・発行者は拠点社名）
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { C, LOGO_PATH, LOGO_W, LOGO_H } from "@/components/pdf/theme";
import type { FlyerData } from "@/lib/tver/flyer-data";

const NAVY = C.accent;
const GOLD = "#b8934a";
const PAPER = "#fbfaf7";

function man(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万人`;
  return `${Math.round(n).toLocaleString("ja-JP")}人`;
}
function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 9.5, color: C.body, backgroundColor: PAPER, paddingTop: 36, paddingBottom: 56, paddingHorizontal: 44 },

  // ── 上段: 発行者 ／ グループ表記
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  issuer: { fontSize: 11, fontWeight: "bold", color: C.ink },
  issuerSub: { fontSize: 7, color: C.faint, marginTop: 2, letterSpacing: 0.5 },
  groupWrap: { alignItems: "flex-end" },
  groupLabel: { fontSize: 6.5, color: C.faint, letterSpacing: 2, marginTop: 3 },
  logo: { width: LOGO_W * 0.8, height: LOGO_H * 0.8 },

  // ── 見出し
  kicker: { fontSize: 7.5, color: GOLD, letterSpacing: 3, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: "bold", color: NAVY, letterSpacing: 1, lineHeight: 1.25 },
  lead: { fontSize: 10, color: C.body, marginTop: 8, lineHeight: 1.6 },
  client: { fontSize: 10.5, fontWeight: "bold", color: C.ink, marginBottom: 10 },

  // ── 数値カード
  cards: { flexDirection: "row", marginTop: 16, gap: 8 },
  card: { flex: 1, backgroundColor: C.white, borderTopWidth: 2.5, borderTopColor: C.line, paddingVertical: 12, paddingHorizontal: 12 },
  cardEm: { borderTopColor: GOLD },
  cardValue: { fontSize: 19, fontWeight: "bold", color: NAVY, letterSpacing: -0.3 },
  cardLabel: { fontSize: 7.5, color: C.mid, marginTop: 6 },

  // ── 帯
  band: { backgroundColor: NAVY, marginTop: 12, paddingVertical: 12, paddingHorizontal: 18 },
  bandText: { fontSize: 11.5, color: C.white, lineHeight: 1.6 },
  bandEm: { color: "#e6c97a", fontWeight: "bold" },

  // ── 2カラム（定義 ／ 一言）
  cols: { flexDirection: "row", gap: 12, marginTop: 12 },
  col: { flex: 1, backgroundColor: C.white, padding: 12 },
  colTitle: { fontSize: 9, fontWeight: "bold", color: NAVY, marginBottom: 8, letterSpacing: 0.5 },
  bullet: { flexDirection: "row", marginBottom: 5 },
  dot: { width: 10, fontSize: 8, color: GOLD },
  bulletText: { flex: 1, fontSize: 8.5, lineHeight: 1.55, color: C.body },
  catchText: { fontSize: 9, lineHeight: 1.7, color: C.body },

  // ── 比較表
  tableWrap: { marginTop: 12, backgroundColor: C.white, padding: 12 },
  tableTitle: { fontSize: 8.5, fontWeight: "bold", color: NAVY, marginBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: C.lineSoft, paddingVertical: 5 },
  trHead: { borderBottomColor: C.line },
  trEm: { backgroundColor: "#f6f2e8" },
  th: { fontSize: 7, color: C.faint },
  td: { fontSize: 8.5, color: C.body },
  tdEm: { fontWeight: "bold", color: NAVY },
  cName: { flex: 2.2, paddingLeft: 4 },
  cNum: { flex: 1.3, textAlign: "right" },
  cYen: { flex: 1.5, textAlign: "right", paddingRight: 4 },

  // ── 注記
  notes: { marginTop: 10 },
  note: { fontSize: 6.8, color: C.faint, lineHeight: 1.5 },

  // ── フッター
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, borderTopWidth: 0.8, borderTopColor: C.line, paddingTop: 7, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  fLeft: { fontSize: 8, color: C.body },
  fLeftSub: { fontSize: 6.8, color: C.faint, marginTop: 2 },
  fRight: { fontSize: 6.8, color: C.faint, letterSpacing: 0.8, textAlign: "right" },
});

export function TverFlyerDocument({ data }: { data: FlyerData }) {
  const cov = data.coverage;
  const multiArea = data.municipalityNames.length > 1;
  const areaDesc = multiArea
    ? `${data.prefName} ${data.municipalityNames.join("・")}（合計人口 ${data.population.toLocaleString("ja-JP")}人）`
    : `${data.prefName}${data.areaLabel}（人口 ${data.population.toLocaleString("ja-JP")}人）`;
  const secLabel = data.seconds === 15 ? "15秒CM" : `${data.seconds}秒CM`;

  return (
    <Document title={`${data.areaLabel}を、まるごと。`} author={data.issuerName} creator="Ad Arch Group OS">
      <Page size="A4" style={s.page}>
        {/* 上段 */}
        <View style={s.top}>
          <View>
            <Text style={s.issuer}>{data.issuerName}</Text>
            <Text style={s.issuerSub}>TVer広告 商圏網羅プランのご案内</Text>
          </View>
          <View style={s.groupWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={LOGO_PATH} style={s.logo} />
            <Text style={s.groupLabel}>AD ARCH GROUP</Text>
          </View>
        </View>

        {data.clientName ? <Text style={s.client}>{data.clientName} 御中</Text> : null}

        {/* 見出し */}
        <Text style={s.kicker}>FOR YOUR AREA ／ 御社の商圏</Text>
        <Text style={s.title}>{data.areaLabel}を、まるごと。</Text>
        <Text style={s.lead}>
          {areaDesc}の商圏を、TVer広告（{secLabel}）で押さえる場合の金額です。
          {"\n"}民放公式のテレビ配信サービスで、テレビ局の番組が、そのままの品質で配信されています。
        </Text>

        {/* 数値カード */}
        <View style={s.cards}>
          <View style={s.card}>
            <Text style={s.cardValue}>{man(data.viewers)}</Text>
            <Text style={s.cardLabel}>TVer視聴者（推計）</Text>
          </View>
          <View style={[s.card, s.cardEm]}>
            <Text style={s.cardValue}>{man(data.reach)}</Text>
            <Text style={s.cardLabel}>到達する人数（3人に1人）</Text>
          </View>
          <View style={[s.card, s.cardEm]}>
            <Text style={s.cardValue}>{yen(data.monthly)}</Text>
            <Text style={s.cardLabel}>月額 媒体費（税抜）</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardValue}>{yen(data.total)}</Text>
            <Text style={s.cardLabel}>標準3ヶ月 総額（税抜）</Text>
          </View>
        </View>

        {/* 帯 */}
        <View style={s.band}>
          <Text style={s.bandText}>
            {cov.isCustom ? "ご予算" : "同じ"}
            <Text style={s.bandEm}>{cov.isCustom ? yen(cov.budget) : "100万円"}</Text>
            {cov.isCustom ? "なら、" : "を出した場合、"}
            {multiArea ? "商圏内" : "市内"}のTVer視聴者の{" "}
            <Text style={s.bandEm}>{cov.pct.toFixed(1)}%</Text>
            （約{Math.round(cov.reach).toLocaleString("ja-JP")}人）に届きます。
          </Text>
        </View>

        {/* 定義 ／ 一言 */}
        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.colTitle}>3ヶ月で、商圏の認知を取り切る</Text>
            {[
              "商圏のTVer視聴者の3人に1人へ、月平均約5回。",
              "単月でなく標準3ヶ月で、認知を取り切ります。",
              "スマホ・PC・テレビ画面（CTV）に届きます。",
              "最寄りの担当が直接お伺いし、対面で伴走します。",
            ].map((t, i) => (
              <View key={i} style={s.bullet}>
                <Text style={s.dot}>●</Text>
                <Text style={s.bulletText}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={s.col}>
            <Text style={s.colTitle}>{data.industry ? `${data.industry}の皆さまへ` : "地元の企業の皆さまへ"}</Text>
            <Text style={s.catchText}>
              {data.catchCopy ??
                "テレビ番組を見ているその時間に、\n地元の会社として名前を届けます。\nまず商圏を決めるところから、ご一緒します。"}
            </Text>
          </View>
        </View>

        {/* 比較表 */}
        {data.neighbors.length > 0 && (
          <View style={s.tableWrap}>
            <Text style={s.tableTitle}>ご参考：{data.prefName}内で規模の近い市との比較（月額・{secLabel}）</Text>
            <View style={[s.tr, s.trHead]}>
              <Text style={[s.th, s.cName]}>エリア</Text>
              <Text style={[s.th, s.cNum]}>人口</Text>
              <Text style={[s.th, s.cNum]}>TVer視聴者（推計）</Text>
              <Text style={[s.th, s.cYen]}>月額 媒体費</Text>
            </View>
            <View style={[s.tr, s.trEm]}>
              <Text style={[s.td, s.tdEm, s.cName]}>{data.areaLabel}</Text>
              <Text style={[s.td, s.tdEm, s.cNum]}>{data.population.toLocaleString("ja-JP")}人</Text>
              <Text style={[s.td, s.tdEm, s.cNum]}>{man(data.viewers)}</Text>
              <Text style={[s.td, s.tdEm, s.cYen]}>{yen(data.monthly)}</Text>
            </View>
            {data.neighbors.map((n) => (
              <View key={n.areaLabel} style={s.tr}>
                <Text style={[s.td, s.cName]}>{n.areaLabel}</Text>
                <Text style={[s.td, s.cNum]}>{n.population.toLocaleString("ja-JP")}人</Text>
                <Text style={[s.td, s.cNum]}>{man(n.viewers)}</Text>
                <Text style={[s.td, s.cYen]}>{yen(n.monthly)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 注記 */}
        <View style={s.notes}>
          <Text style={s.note}>
            ※ 視聴者数・到達人数・カバー率は推計値であり、保証値ではありません。TVer視聴者数は TVer INC. 公表の月間ユーザー数（2026年1月・4,470万）を
            総務省「人口推計」「住民基本台帳人口」で按分した推計です。到達人数は当社配信実績のフリークエンシーをもとに算出しています。
          </Text>
          <Text style={s.note}>
            ※ 金額は媒体費（税抜）です。CM制作費・考査費等は別途お見積りします。商圏が複数の市町村にまたがる場合は合算してお出しします。
          </Text>
        </View>

        {/* フッター */}
        <View style={s.footer} fixed>
          <View>
            <Text style={s.fLeft}>{data.issuerContact ? `お問い合わせ: ${data.issuerContact}` : data.issuerName}</Text>
            <Text style={s.fLeftSub}>{data.issuerName === "Ad Archグループ" ? "TVer広告 商圏網羅プラン" : `${data.issuerName} ／ Ad Archグループ`}</Text>
          </View>
          <Text style={s.fRight}>{fmtDate(data.date)}{"\n"}TVer ADVERTISING</Text>
        </View>
      </Page>
    </Document>
  );
}
