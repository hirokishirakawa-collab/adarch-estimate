// TVer広告 エリア限定プラン — 発注書PDF（サーバー専用・@react-pdf/renderer）
//   2026-09-14〜 相談 → 面談 → 業態考査 → 本部が発注書を発行 → お客様が進捗ページで確認・署名 → 初月の支払い
//   発注者＝広告主（甲）／受注者＝Ad Arch株式会社（乙）。署名後は同意の記録を載せる。
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { C } from "@/components/pdf/theme";
import { PdfHeader, PdfFooter, IssuerBlock, MetaList } from "@/components/pdf/pdf-kit";

export type OrderDocumentData = {
  no: string;
  issuedAt: Date;
  advertiserName: string;
  contactName: string;
  email: string;
  phone: string;
  postalCode: string | null;
  address: string | null;
  representativeName: string | null;
  areaLabel: string;
  planName: string;
  adSeconds: number;
  months: number;
  mediaFeeExclTax: number;
  monthlyInclTax: number;
  firstInclTax: number;
  contractTotalInclTax: number;
  productName: string | null;
  termsTitle: string;
  termsVersion: string;
  estimateNote: string;
  signed: { signerName: string; agreedAt: Date; ip: string | null } | null;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
const jst = (d: Date, time = false) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(d);

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 9, color: C.body, paddingTop: 40, paddingBottom: 52, paddingHorizontal: 44 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  to: { maxWidth: "52%" },
  toName: { fontSize: 14, fontWeight: "bold", color: C.ink, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 3, marginBottom: 6 },
  small: { fontSize: 8, color: C.mid, lineHeight: 1.6 },
  lead: { fontSize: 9, color: C.body, lineHeight: 1.7, marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: C.ink, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 5 },
  k: { width: "34%", color: C.mid, fontSize: 8.5 },
  v: { width: "66%", color: C.ink, fontSize: 9 },
  totalRow: { flexDirection: "row", backgroundColor: C.accentSoft, paddingVertical: 7, paddingHorizontal: 6, marginTop: 6 },
  totalK: { width: "34%", fontWeight: "bold", color: C.accent, fontSize: 9.5 },
  totalV: { width: "66%", fontWeight: "bold", color: C.accent, fontSize: 12 },
  signBox: { borderWidth: 1, borderColor: C.line, padding: 10, marginTop: 14 },
});

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

export function OrderDocumentPDF({ d }: { d: OrderDocumentData }) {
  return (
    <Document title={`発注書 ${d.no}`}>
      <Page size="A4" style={s.page}>
        <PdfHeader title="発注書" subtitle="Purchase Order" />
        <View style={s.infoRow}>
          <View style={s.to}>
            <Text style={s.toName}>Ad Arch株式会社 御中</Text>
            <Text style={s.small}>（受注者・TVer広告 正規代理店）</Text>
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 8, color: C.faint }}>発注者</Text>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: C.ink, marginTop: 2 }}>{d.advertiserName}</Text>
              {d.address ? <Text style={s.small}>{`${d.postalCode ? `〒${d.postalCode} ` : ""}${d.address}`}</Text> : null}
              {d.representativeName ? <Text style={s.small}>{`代表者 ${d.representativeName}`}</Text> : null}
              <Text style={s.small}>{`ご担当 ${d.contactName}　${d.email}　${d.phone}`}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <MetaList items={[{ label: "申込番号", value: d.no }, { label: "発行日", value: jst(d.issuedAt) }, ...(d.signed ? [{ label: "署名日", value: jst(d.signed.agreedAt) }] : [])]} />
            <View style={{ marginTop: 12 }}>
              <IssuerBlock />
            </View>
          </View>
        </View>

        <Text style={s.lead}>{`下記の内容で、TVer広告 エリア限定プランを発注します。${d.termsTitle}（${d.termsVersion}）に従います。`}</Text>

        <Text style={s.sectionTitle}>発注内容</Text>
        <Row k="品目" v={`TVer広告 エリア限定プラン ${d.planName}（${d.adSeconds}秒CM）`} />
        {d.productName ? <Row k="商材名／キャンペーン名" v={d.productName} /> : null}
        <Row k="配信エリア" v={d.areaLabel} />
        <Row k="契約期間" v={`${d.months}ヶ月（配信開始日から）`} />
        <Row k="月額 媒体費（税抜）" v={yen(d.mediaFeeExclTax)} />
        <Row k="月額（税込）" v={yen(d.monthlyInclTax)} />
        <Row k="初回登録費・管理費" v="なし" />
        <View style={s.totalRow}>
          <Text style={s.totalK}>{`契約総額（税込・${d.months}ヶ月）`}</Text>
          <Text style={s.totalV}>{yen(d.contractTotalInclTax)}</Text>
        </View>

        <Text style={s.sectionTitle}>お支払い条件</Text>
        <Text style={s.small}>{`月払い。初月分（税込 ${yen(d.firstInclTax)}）は発注書へのご署名の後に前払いいただき、そのお支払いの確認をもって契約が成立します。`}</Text>
        <Text style={s.small}>{"2ヶ月目以降は、配信開始日の各月の応当日を期限として、その7日前までに請求します。"}</Text>
        <Text style={s.small}>{"クレジットカード＝毎月の決済リンク／銀行振込＝毎月の請求書（振込手数料はご負担ください）。"}</Text>

        <Text style={s.sectionTitle}>備考</Text>
        <Text style={s.small}>・TVerの業態考査は発注書の発行前に完了しています。動画素材のクリエイティブ考査は契約成立後に行います。</Text>
        {d.estimateNote.split("。").filter(Boolean).map((t, i) => (
          <Text key={i} style={s.small}>{`${i === 0 ? "・" : "　"}${t}。`}</Text>
        ))}
        <Text style={s.small}>・契約期間中の配信エリア・プラン・動画素材の変更はできません。</Text>

        <View style={s.signBox}>
          <Text style={{ fontSize: 8, color: C.faint, marginBottom: 4 }}>電子署名</Text>
          {d.signed ? (
            <>
              <Text style={{ fontSize: 9, color: C.ink, lineHeight: 1.6 }}>{`${d.signed.signerName} 様が ${jst(d.signed.agreedAt, true)} に同意し、署名しました。`}</Text>
              <Text style={s.small}>{`同意の対象: 本発注書・${d.termsTitle}（${d.termsVersion}）${d.signed.ip ? `　IP ${d.signed.ip}` : ""}`}</Text>
            </>
          ) : (
            <Text style={{ fontSize: 9, color: C.mid }}>未署名です。お申込みの進捗ページで内容をご確認のうえ、ご署名ください。</Text>
          )}
        </View>

        <PdfFooter label={`Ad Arch株式会社　発注書 ${d.no}`} />
      </Page>
    </Document>
  );
}
