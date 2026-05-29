// サーバー専用 — API ルートから呼び出す
// @react-pdf/renderer は Node.js でのみ動作

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { C, fmtMoney, fmtDate } from "@/components/pdf/theme";
import { PdfHeader, PdfFooter, IssuerBlock, MetaList } from "@/components/pdf/pdf-kit";
import { breakdownFromStored } from "@/lib/payment-statement-calc";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
export type PaymentStatementForPDF = {
  id: string;
  title: string;
  clientName: string | null;
  description: string | null;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  mediaExpense: number;
  productionExpense: number;
  withholdingTaxAmount: number;
  nonDeductibleTaxAmount: number;
  netPaymentAmount: number;
  status: string;
  paidAt: Date | string | null;
  createdAt: Date | string;
  items?: { clientName: string; grossAmount: number; note: string | null }[];
  groupCompany: {
    name: string;
    ownerName: string;
    entityType: string;
    invoiceRegistered: boolean;
    bankName: string | null;
    bankBranch: string | null;
    bankAccountType: string | null;
    bankAccountNumber: string | null;
    bankAccountHolder: string | null;
  };
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

  // 宛先 & 発行元
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  recipientBox: { maxWidth: "55%" },
  infoLabel: { fontSize: 7, color: C.faint, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase" },
  infoName: { fontSize: 14, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, borderBottomWidth: 1, borderBottomColor: C.line, alignSelf: "flex-start", paddingBottom: 3 },
  infoSub: { fontSize: 8, color: C.mid, marginTop: 4 },
  rightCol: { alignItems: "flex-end" },
  issuerSpacer: { marginTop: 12 },

  // 件名
  subjectRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  subjectBar: { width: 3, height: 13, backgroundColor: C.accent, marginRight: 8 },
  subjectText: { fontSize: 11, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink },
  subjectSub: { fontSize: 8, color: C.mid, marginTop: 3, marginLeft: 11 },

  // 金額テーブル
  table: { marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: C.accent, paddingVertical: 6, paddingHorizontal: 12 },
  tableHeaderText: { fontSize: 8, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.white, letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 6, paddingHorizontal: 12 },
  tableRowAlt: { backgroundColor: C.rowAlt },
  rowLabel: { fontSize: 8.5, color: C.body },
  colLabel: { width: "62%" },
  colAmount: { width: "38%", textAlign: "right" },

  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.accentSoft,
    borderRadius: 3,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  grandLabel: { fontSize: 10.5, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent },
  grandValue: { fontSize: 14, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent },

  // 振込先
  bankBox: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 12, marginBottom: 14 },
  bankLabel: { fontSize: 7, color: C.faint, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase" },
  bankText: { fontSize: 9, color: C.body },

  // 備考
  noteBox: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  noteLabel: { fontSize: 8, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.mid, marginBottom: 4, letterSpacing: 0.5 },
  noteText: { fontSize: 8.5, color: C.body, lineHeight: 1.6 },
});

// ----------------------------------------------------------------
// PDF ドキュメント
// ----------------------------------------------------------------
export function PaymentStatementPDFDocument({
  statement,
}: {
  statement: PaymentStatementForPDF;
}) {
  const gc = statement.groupCompany;
  const hasItems = !!statement.items && statement.items.length > 0;
  const b = breakdownFromStored({
    grossAmount: statement.grossAmount,
    commissionRate: statement.commissionRate,
    commissionAmount: statement.commissionAmount,
    mediaExpense: statement.mediaExpense,
    productionExpense: statement.productionExpense,
    withholdingTaxAmount: statement.withholdingTaxAmount,
    nonDeductibleTaxAmount: statement.nonDeductibleTaxAmount,
    netPaymentAmount: statement.netPaymentAmount,
  });

  const rows: { label: string; amount: number; isDeduction?: boolean; isSub?: boolean }[] = [];
  if (hasItems) {
    statement.items!.forEach((it) => {
      rows.push({ label: `入金 — ${it.clientName}${it.note ? `（${it.note}）` : ""}`, amount: it.grossAmount });
    });
    rows.push({ label: "入金額合計（税込）", amount: b.grossInclTax });
  } else {
    rows.push({ label: "入金額（税込）", amount: b.grossInclTax });
  }
  rows.push({ label: "　本体（税抜）", amount: b.grossExclTax, isSub: true });
  rows.push({ label: "　消費税（10%）", amount: b.grossTax, isSub: true });
  rows.push({
    label: `本部手数料（${statement.commissionRate}%・税抜）`,
    amount: -b.commissionExclTax,
    isDeduction: true,
  });
  rows.push({ label: "パートナー報酬（税抜）", amount: b.partnerFeeExclTax });
  rows.push({ label: "消費税（10%）", amount: b.partnerTax });
  rows.push({ label: "パートナー報酬（税込）", amount: b.partnerInclTax });
  if (b.withholdingTaxAmount > 0) {
    rows.push({ label: `源泉徴収税（制作費 ${fmtMoney(b.productionExclTax)}）`, amount: -b.withholdingTaxAmount, isDeduction: true });
  }
  if (b.nonDeductibleTaxAmount > 0) {
    rows.push({
      label: "控除不可消費税（インボイス未登録）",
      amount: -b.nonDeductibleTaxAmount,
      isDeduction: true,
    });
  }

  const bankType =
    gc.bankAccountType === "SAVINGS" ? "普通" : gc.bankAccountType === "CHECKING" ? "当座" : "";
  const entityLabel =
    gc.entityType === "SOLE_PROPRIETOR" ? "個人事業主" : gc.entityType === "CORPORATION" ? "法人" : "";

  const meta = [
    { label: "発行日", value: fmtDate(statement.paidAt || statement.createdAt) },
    { label: "No.", value: statement.id.slice(-8).toUpperCase() },
  ];

  return (
    <Document title={`支払明細書 ${statement.title}`} author="Ad Arch株式会社" creator="Ad Arch Group OS">
      <Page size="A4" style={s.page}>
        <PdfHeader title="支払明細書" subtitle="Statement" />

        {/* 宛先 & メタ & 発行元 */}
        <View style={s.infoRow}>
          <View style={s.recipientBox}>
            <Text style={s.infoLabel}>お支払先</Text>
            <Text style={s.infoName}>{gc.name}</Text>
            <Text style={s.infoSub}>{gc.ownerName} 様</Text>
            <Text style={s.infoSub}>
              {entityLabel} / インボイス{gc.invoiceRegistered ? "登録済" : "未登録"}
            </Text>
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
          <Text style={s.subjectText}>{statement.title}</Text>
        </View>
        {statement.clientName && (
          <Text style={s.subjectSub}>クライアント: {statement.clientName}</Text>
        )}

        {/* 金額テーブル */}
        <View style={[s.table, { marginTop: 12 }]}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.colLabel]}>項目</Text>
            <Text style={[s.tableHeaderText, s.colAmount]}>金額</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.rowLabel, s.colLabel]}>{row.label}</Text>
              <Text
                style={[
                  s.colAmount,
                  s.rowLabel,
                  { color: row.isDeduction ? "#b91c1c" : C.body, fontFamily: "NotoSansJP", fontWeight: "bold" },
                ]}
              >
                {row.isDeduction ? `−${fmtMoney(Math.abs(row.amount))}` : fmtMoney(row.amount)}
              </Text>
            </View>
          ))}
          {/* 合計 */}
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>差引支払額</Text>
            <Text style={s.grandValue}>{fmtMoney(b.netPaymentAmount)}</Text>
          </View>
        </View>

        {/* 振込先 */}
        {gc.bankName && gc.bankAccountNumber && (
          <View style={s.bankBox}>
            <Text style={s.bankLabel}>お振込先</Text>
            <Text style={s.bankText}>
              {gc.bankName} {gc.bankBranch} / {bankType} {gc.bankAccountNumber} / {gc.bankAccountHolder}
            </Text>
          </View>
        )}

        {/* 備考 */}
        {statement.description && (
          <View style={s.noteBox}>
            <Text style={s.noteLabel}>備考</Text>
            <Text style={s.noteText}>{statement.description}</Text>
          </View>
        )}

        <PdfFooter label="Ad Arch株式会社 — 支払明細書" />
      </Page>
    </Document>
  );
}
