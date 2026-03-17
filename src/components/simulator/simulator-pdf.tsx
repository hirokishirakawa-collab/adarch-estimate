// サーバー専用 — @react-pdf/renderer は Node.js でのみ動作
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";

// 日本語フォント登録
Font.register({
  family: "NotoSansJP",
  src: path.join(process.cwd(), "public/fonts/NotoSansJP.ttf"),
});

// 型定義
export interface SimulatorPDFData {
  simulatorName: string;   // シミュレーター名 (例: "すかいらーくインストア広告")
  totalAmount: number;     // クライアント提示総額（税抜）
  taxRate?: number;        // 消費税率 (デフォルト 0.10)
  notes?: string;          // 備考
  conditions?: string[];   // 主要条件（例: ["100店舗 / 4週間", "テーブルステッカー"]）
  date?: string;           // 日付
}

// ヘルパー
function fmtDate(d?: string): string {
  const date = d ? new Date(d) : new Date();
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function fmtMoney(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

// スタイル
const TEAL = "#0f766e";
const GRAY_DARK = "#1a1a1a";
const GRAY_MID = "#6b7280";
const GRAY_BORDER = "#e4e4e7";

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: GRAY_DARK,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 44,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  titleBlock: { flexDirection: "column" },
  titleMain: { fontSize: 22, fontFamily: "NotoSansJP", color: TEAL, fontWeight: "bold" },
  titleSub: { fontSize: 8, color: GRAY_MID, marginTop: 3 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { flexDirection: "row", gap: 6, marginBottom: 3 },
  metaLabel: { fontSize: 8, color: GRAY_MID, width: 54, textAlign: "right" },
  metaValue: { fontSize: 8, color: GRAY_DARK },
  divider: { borderBottomWidth: 1, borderBottomColor: TEAL, marginBottom: 20 },

  addressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  addressBlock: { flexDirection: "column" },
  addressTo: { fontSize: 14, fontFamily: "NotoSansJP", color: GRAY_DARK, marginBottom: 4 },
  greetingText: { fontSize: 8.5, color: GRAY_MID, marginTop: 4 },
  companyBlock: { alignItems: "flex-end" },
  companyName: { fontSize: 11, fontFamily: "NotoSansJP", color: GRAY_DARK },
  companyDetail: { fontSize: 7.5, color: GRAY_MID, marginTop: 2 },

  // 件名
  subjectSection: { marginBottom: 24 },
  subjectText: { fontSize: 11, fontFamily: "NotoSansJP", color: GRAY_DARK },

  // 条件
  conditionsSection: { marginBottom: 20 },
  conditionsLabel: { fontSize: 8, color: GRAY_MID, marginBottom: 6 },
  conditionRow: { flexDirection: "row", gap: 6, marginBottom: 3 },
  conditionDot: { fontSize: 8, color: TEAL },
  conditionText: { fontSize: 9, color: GRAY_DARK },

  // 総額表示
  totalSection: {
    marginTop: 8,
    marginBottom: 24,
    padding: 20,
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 4,
    alignItems: "center",
  },
  totalLabel: { fontSize: 10, color: GRAY_MID, marginBottom: 8 },
  totalAmount: { fontSize: 28, fontFamily: "NotoSansJP", color: TEAL, fontWeight: "bold" },
  totalTaxNote: { fontSize: 9, color: GRAY_MID, marginTop: 4 },
  taxLine: { flexDirection: "row", gap: 20, marginTop: 8 },
  taxItem: { fontSize: 8.5, color: GRAY_DARK },

  // 備考
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: GRAY_BORDER,
    paddingTop: 10,
    marginTop: 4,
  },
  notesLabel: { fontSize: 8, color: GRAY_MID, marginBottom: 4 },
  notesText: { fontSize: 8.5, color: GRAY_DARK, lineHeight: 1.6 },

  // フッター
  footer: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: GRAY_BORDER,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: GRAY_MID },
});

// PDF ドキュメント
export function SimulatorPDFDocument({ data }: { data: SimulatorPDFData }) {
  const taxRate = data.taxRate ?? 0.10;
  const tax = Math.round(data.totalAmount * taxRate);
  const totalWithTax = data.totalAmount + tax;

  return (
    <Document title={`${data.simulatorName} 概算見積`} author="Ad-Arch Group OS">
      <Page size="A4" style={s.page}>

        {/* ヘッダー */}
        <View style={s.headerRow}>
          <View style={s.titleBlock}>
            <Text style={s.titleMain}>概 算 見 積</Text>
            <Text style={s.titleSub}>ESTIMATE</Text>
          </View>
          <View style={s.metaBlock}>
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>発行日</Text>
              <Text style={s.metaValue}>{fmtDate(data.date)}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* 宛名 + 発行元 */}
        <View style={s.addressRow}>
          <View style={s.addressBlock}>
            <Text style={s.addressTo}>御中</Text>
            <Text style={s.greetingText}>
              下記の通り概算をお見積もり申し上げます。
            </Text>
          </View>
          <View style={s.companyBlock}>
            <Text style={s.companyName}>株式会社 Ad-Arch</Text>
            <Text style={s.companyDetail}>Ad-Arch Group OS</Text>
            <Text style={s.companyDetail}>info@adarch.co.jp</Text>
          </View>
        </View>

        {/* 件名 */}
        <View style={s.subjectSection}>
          <Text style={s.subjectText}>{data.simulatorName} 概算見積</Text>
        </View>

        {/* 主要条件 */}
        {data.conditions && data.conditions.length > 0 && (
          <View style={s.conditionsSection}>
            <Text style={s.conditionsLabel}>主要条件</Text>
            {data.conditions.map((c, i) => (
              <View key={i} style={s.conditionRow}>
                <Text style={s.conditionDot}>●</Text>
                <Text style={s.conditionText}>{c}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 総額 */}
        <View style={s.totalSection}>
          <Text style={s.totalLabel}>ご提示金額（税抜）</Text>
          <Text style={s.totalAmount}>{fmtMoney(data.totalAmount)}</Text>
          <Text style={s.totalTaxNote}>（税抜価格）</Text>
          <View style={s.taxLine}>
            <Text style={s.taxItem}>消費税（{Math.round(taxRate * 100)}%）: {fmtMoney(tax)}</Text>
            <Text style={s.taxItem}>税込合計: {fmtMoney(totalWithTax)}</Text>
          </View>
        </View>

        {/* 備考 */}
        <View style={s.notesSection}>
          <Text style={s.notesLabel}>備考</Text>
          <Text style={s.notesText}>
            {data.notes ?? "本見積は概算であり、正式な発注時に詳細なお見積もりを改めてご提出いたします。\n金額は予告なく変更される場合がございます。"}
          </Text>
        </View>

        {/* フッター */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Ad-Arch Group OS — {data.simulatorName} 概算見積</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
        </View>

      </Page>
    </Document>
  );
}
