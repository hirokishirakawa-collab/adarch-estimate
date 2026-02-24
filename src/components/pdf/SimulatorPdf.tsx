import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/lib/pdfFonts";

registerPdfFonts();

export interface PdfRow {
  label: string;
  value: string;
  bold?: boolean;
  divider?: boolean;
}

export interface PdfSection {
  title: string;
  rows: PdfRow[];
}

export interface SimulatorPdfData {
  simulatorName: string;
  sections: PdfSection[];
  clientPrice: string;
  purchasePrice: string;
  margin: string;
  priceNote?: string;
}

const S = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    paddingTop: 30,
    paddingBottom: 50,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 9,
    color: "#333333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#222222",
    borderBottomStyle: "solid",
  },
  headerBrand: {
    fontSize: 13,
    fontWeight: 700,
    color: "#111111",
  },
  headerMid: {
    fontSize: 10,
    color: "#666666",
  },
  confidentialBadge: {
    fontSize: 8,
    fontWeight: 700,
    color: "#cc0000",
    borderWidth: 1,
    borderColor: "#cc0000",
    borderStyle: "solid",
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 6,
    paddingRight: 6,
  },
  titleArea: {
    marginBottom: 16,
  },
  simulatorName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111111",
    marginBottom: 3,
  },
  dateText: {
    fontSize: 9,
    color: "#888888",
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "solid",
    borderRadius: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    backgroundColor: "#f9fafb",
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 9,
    fontWeight: 700,
    color: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    borderBottomStyle: "solid",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 12,
    paddingRight: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
    borderBottomStyle: "solid",
  },
  rowLabel: {
    fontSize: 8.5,
    color: "#6b7280",
    flex: 1,
  },
  rowValue: {
    fontSize: 8.5,
    color: "#111827",
    textAlign: "right",
  },
  rowValueBold: {
    fontSize: 9,
    color: "#111827",
    fontWeight: 700,
    textAlign: "right",
  },
  dividerLine: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    borderTopStyle: "solid",
    marginTop: 3,
    marginBottom: 3,
    marginLeft: 12,
    marginRight: 12,
  },
  priceBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderStyle: "solid",
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  priceBoxTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#bfdbfe",
    borderBottomStyle: "solid",
  },
  priceRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 2,
  },
  priceLabelWrap: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 8.5,
    color: "#4b5563",
  },
  priceNote: {
    fontSize: 7.5,
    color: "#9ca3af",
    marginTop: 2,
  },
  clientPriceValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e3a8a",
  },
  purchasePriceValue: {
    fontSize: 10,
    fontWeight: 700,
    color: "#374151",
  },
  marginValue: {
    fontSize: 11,
    fontWeight: 700,
    color: "#059669",
  },
  notesArea: {
    marginTop: 4,
    marginBottom: 12,
  },
  noteText: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#d1d5db",
    borderTopStyle: "solid",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "center",
  },
  footerTextRed: {
    fontSize: 7.5,
    fontWeight: 700,
    color: "#dc2626",
  },
  footerText: {
    fontSize: 7.5,
    color: "#9ca3af",
  },
});

export function SimulatorPdfDocument({ data }: { data: SimulatorPdfData }) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 生成`;

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* ヘッダー */}
        <View style={S.header}>
          <Text style={S.headerBrand}>Ad Arch Group</Text>
          <Text style={S.headerMid}>概算書</Text>
          <Text style={S.confidentialBadge}>CONFIDENTIAL</Text>
        </View>

        {/* タイトル */}
        <View style={S.titleArea}>
          <Text style={S.simulatorName}>{data.simulatorName} 概算書</Text>
          <Text style={S.dateText}>{dateStr}</Text>
        </View>

        {/* セクション */}
        {data.sections.map((section, si) => (
          <View key={si} style={S.sectionCard}>
            <Text style={S.sectionTitle}>{section.title}</Text>
            {section.rows.map((row, ri) =>
              row.divider ? (
                <View key={ri} style={S.dividerLine} />
              ) : (
                <View key={ri} style={S.row}>
                  <Text style={S.rowLabel}>{row.label}</Text>
                  <Text style={row.bold ? S.rowValueBold : S.rowValue}>
                    {row.value}
                  </Text>
                </View>
              )
            )}
          </View>
        ))}

        {/* Ad-Arch 提示価格 */}
        <View style={S.priceBox}>
          <Text style={S.priceBoxTitle}>Ad-Arch 提示価格</Text>

          <View style={S.priceRow}>
            <View style={S.priceLabelWrap}>
              <Text style={S.priceLabel}>クライアント提示（管理費込）</Text>
              {data.priceNote ? (
                <Text style={S.priceNote}>{data.priceNote}</Text>
              ) : null}
            </View>
            <Text style={S.clientPriceValue}>{data.clientPrice}</Text>
          </View>

          <View style={S.priceRow}>
            <Text style={S.priceLabel}>仕入れ価格（参考）</Text>
            <Text style={S.purchasePriceValue}>{data.purchasePrice}</Text>
          </View>

          <View style={S.priceRowLast}>
            <Text style={S.priceLabel}>粗利（参考）</Text>
            <Text style={S.marginValue}>{data.margin}</Text>
          </View>
        </View>

        {/* 備考 */}
        <View style={S.notesArea}>
          <Text style={S.noteText}>※ 上記金額は消費税抜きです</Text>
          <Text style={S.noteText}>
            ※ 本資料の金額はシミュレーション値であり、実際の金額は変動することがあります
          </Text>
        </View>

        {/* フッター */}
        <View style={S.footer} fixed>
          <Text style={S.footerTextRed}>CONFIDENTIAL</Text>
          <Text style={S.footerText}> - 社外秘 · Ad Arch Group</Text>
        </View>
      </Page>
    </Document>
  );
}
