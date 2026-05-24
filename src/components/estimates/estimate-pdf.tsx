// このファイルはサーバー専用（API ルートから呼び出す）
// @react-pdf/renderer は Node.js でのみ動作します

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { C, fmtMoney, fmtDate, toNum } from "@/components/pdf/theme";
import { PdfHeader, PdfFooter, IssuerBlock, MetaList } from "@/components/pdf/pdf-kit";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
type EstimationItem = {
  id: string;
  name: string;
  spec: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: { toNumber: () => number } | number;
  amount: { toNumber: () => number } | number;
};

export type EstimateForPDF = {
  id: string;
  title: string;
  status: string;
  estimateDate: Date | string;
  validUntil: Date | string | null;
  staffName: string | null;
  notes: string | null;
  discountAmount: { toNumber: () => number } | number | null;
  customer: { name: string } | null;
  branch: { name: string } | null;
  items: EstimationItem[];
};

// ----------------------------------------------------------------
// スタイル
// ----------------------------------------------------------------
const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: C.body,
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 44,
  },

  // ── 宛名 / 発行元
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  addressBlock: { flexDirection: "column", maxWidth: "55%" },
  addressTo: { fontSize: 15, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, marginBottom: 5 },
  addressToLine: { borderBottomWidth: 1, borderBottomColor: C.line, alignSelf: "flex-start", paddingBottom: 2, minWidth: 160 },
  greetingText: { fontSize: 8.5, color: C.mid, marginTop: 8, lineHeight: 1.5 },
  rightCol: { alignItems: "flex-end" },
  issuerSpacer: { marginTop: 12 },

  // ── 件名
  subjectRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  subjectBar: { width: 3, height: 13, backgroundColor: C.accent, marginRight: 8 },
  subjectText: { fontSize: 11, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink },

  // ── 明細テーブル
  tableContainer: { marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: C.accent, paddingVertical: 6, paddingHorizontal: 6 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.lineSoft,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRowAlt: { backgroundColor: C.rowAlt },
  thText: { fontSize: 8, color: C.white, fontFamily: "NotoSansJP", fontWeight: "bold", letterSpacing: 0.5 },
  tdText: { fontSize: 8.5, color: C.body },

  colName: { width: "28%" },
  colSpec: { width: "32%" },
  colQty: { width: "8%", textAlign: "right" },
  colUnit: { width: "7%", textAlign: "center" },
  colPrice: { width: "12%", textAlign: "right" },
  colAmount: { width: "13%", textAlign: "right" },

  // ── 合計エリア
  totalsContainer: { alignItems: "flex-end", marginBottom: 18 },
  totalsBox: { width: 232 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 8.5, color: C.mid },
  totalValue: { fontSize: 8.5, color: C.body, fontFamily: "NotoSansJP" },
  totalDivider: { borderBottomWidth: 1, borderBottomColor: C.line, marginVertical: 4 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.accentSoft,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  grandLabel: { fontSize: 10, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent },
  grandValue: { fontSize: 13, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent },

  // ── 備考
  notesSection: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, marginTop: 2 },
  notesLabel: { fontSize: 8, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.mid, marginBottom: 4, letterSpacing: 0.5 },
  notesText: { fontSize: 8.5, color: C.body, lineHeight: 1.6 },
});

// ----------------------------------------------------------------
// PDF ドキュメント
// ----------------------------------------------------------------
export function EstimatePDFDocument({ estimation }: { estimation: EstimateForPDF }) {
  const {
    id,
    title,
    estimateDate,
    validUntil,
    staffName,
    notes,
    discountAmount: rawDiscount,
    customer,
    items,
  } = estimation;

  // 金額計算（PDF には原価・粗利・値引き理由を含めない）
  const subtotal = items.reduce((acc, it) => acc + toNum(it.amount), 0);
  const discountAmt = toNum(rawDiscount);
  const afterDisc = Math.max(0, subtotal - discountAmt);
  const tax = Math.round(afterDisc * 0.1);
  const total = afterDisc + tax;

  const hasDiscount = discountAmt > 0;
  const customerName = customer?.name ?? null;

  const meta = [
    { label: "見積番号", value: id.slice(-10).toUpperCase() },
    { label: "見積日", value: fmtDate(estimateDate) },
    ...(validUntil ? [{ label: "有効期限", value: fmtDate(validUntil) }] : []),
    { label: "担当者", value: staffName ?? "—" },
  ];

  return (
    <Document title={title} author="Ad Arch株式会社" creator="Ad Arch Group OS">
      <Page size="A4" style={s.page}>
        <PdfHeader title="見 積 書" subtitle="Estimate" />

        {/* 宛名 + メタ + 発行元 */}
        <View style={s.infoRow}>
          <View style={s.addressBlock}>
            <View style={s.addressToLine}>
              <Text style={s.addressTo}>{customerName ? `${customerName} 御中` : "　"}</Text>
            </View>
            <Text style={s.greetingText}>下記の通りお見積もり申し上げます。</Text>
          </View>
          <View style={s.rightCol}>
            <MetaList items={meta} />
            <View style={s.issuerSpacer}>
              <IssuerBlock />
            </View>
          </View>
        </View>

        {/* 件名 */}
        <View style={s.subjectRow}>
          <View style={s.subjectBar} />
          <Text style={s.subjectText}>{title}</Text>
        </View>

        {/* 明細テーブル */}
        <View style={s.tableContainer}>
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.colName]}>品目名</Text>
            <Text style={[s.thText, s.colSpec]}>仕様・備考</Text>
            <Text style={[s.thText, s.colQty]}>数量</Text>
            <Text style={[s.thText, s.colUnit]}>単位</Text>
            <Text style={[s.thText, s.colPrice]}>単価</Text>
            <Text style={[s.thText, s.colAmount]}>金額</Text>
          </View>

          {items.map((item, idx) => (
            <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tdText, s.colName]}>{item.name}</Text>
              <Text style={[s.tdText, s.colSpec, { color: C.mid }]}>{item.spec ?? ""}</Text>
              <Text style={[s.tdText, s.colQty]}>{item.quantity}</Text>
              <Text style={[s.tdText, s.colUnit]}>{item.unit ?? ""}</Text>
              <Text style={[s.tdText, s.colPrice]}>{fmtMoney(toNum(item.unitPrice))}</Text>
              <Text style={[s.tdText, s.colAmount]}>{fmtMoney(toNum(item.amount))}</Text>
            </View>
          ))}
        </View>

        {/* 合計 */}
        <View style={s.totalsContainer}>
          <View style={s.totalsBox}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>小計（税抜）</Text>
              <Text style={s.totalValue}>{fmtMoney(subtotal)}</Text>
            </View>

            {hasDiscount && (
              <>
                <View style={s.totalRow}>
                  <Text style={[s.totalLabel, { color: "#b45309" }]}>出精値引き</Text>
                  <Text style={[s.totalValue, { color: "#b45309" }]}>−{fmtMoney(discountAmt)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>値引後小計</Text>
                  <Text style={s.totalValue}>{fmtMoney(afterDisc)}</Text>
                </View>
              </>
            )}

            <View style={s.totalRow}>
              <Text style={s.totalLabel}>消費税（10%）</Text>
              <Text style={s.totalValue}>{fmtMoney(tax)}</Text>
            </View>

            <View style={s.totalDivider} />

            <View style={s.grandRow}>
              <Text style={s.grandLabel}>合計（税込）</Text>
              <Text style={s.grandValue}>{fmtMoney(total)}</Text>
            </View>
          </View>
        </View>

        {/* 備考 */}
        {notes && (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>備考</Text>
            <Text style={s.notesText}>{notes}</Text>
          </View>
        )}

        <PdfFooter label="Ad Arch株式会社 — 見積書" />
      </Page>
    </Document>
  );
}
