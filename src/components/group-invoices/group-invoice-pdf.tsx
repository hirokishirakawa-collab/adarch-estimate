// サーバー専用 — API ルートから呼び出す（@react-pdf/renderer は Node.js のみ）

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { C, fmtMoney, fmtDate, BILLING_ACCOUNTS } from "@/components/pdf/theme";
import { PdfHeader, PdfFooter, IssuerBlock, MetaList } from "@/components/pdf/pdf-kit";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------
export type GroupInvoiceForPDF = {
  invoiceNo: string;
  type: string;
  title: string;
  targetMonth: string | null;
  description: string | null;
  subtotalExclTax: number;
  taxAmount: number;
  totalInclTax: number;
  issueDate: Date | string;
  dueDate: Date | string | null;
  status: string;
  items: { name: string; detail: string | null; quantity: number; unitPrice: number; amount: number }[];
  groupCompany: { name: string; ownerName: string };
};

// ----------------------------------------------------------------
// スタイル（支払明細書と統一）
// ----------------------------------------------------------------
const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 9, color: C.body, paddingTop: 40, paddingBottom: 52, paddingHorizontal: 44 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  recipientBox: { maxWidth: "55%" },
  infoLabel: { fontSize: 7, color: C.faint, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase" },
  infoName: { fontSize: 14, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, borderBottomWidth: 1, borderBottomColor: C.line, alignSelf: "flex-start", paddingBottom: 3 },
  infoSub: { fontSize: 8, color: C.mid, marginTop: 4 },
  rightCol: { alignItems: "flex-end" },
  issuerSpacer: { marginTop: 12 },

  subjectRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  subjectBar: { width: 3, height: 13, backgroundColor: C.accent, marginRight: 8 },
  subjectText: { fontSize: 11, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink },
  subjectSub: { fontSize: 8, color: C.mid, marginTop: 3, marginLeft: 11 },

  // ご請求金額（強調帯）
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.accent, borderRadius: 3, paddingVertical: 11, paddingHorizontal: 14, marginVertical: 12 },
  billLabel: { fontSize: 11, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.white },
  billValue: { fontSize: 16, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.white },

  // 明細テーブル
  table: { marginBottom: 14 },
  tableHeader: { flexDirection: "row", backgroundColor: C.accentSoft, paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  th: { fontSize: 8, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent, letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 6, paddingHorizontal: 10 },
  td: { fontSize: 8.5, color: C.body },
  tdDetail: { fontSize: 7, color: C.faint, marginTop: 2 },
  colName: { width: "52%" },
  colQty: { width: "12%", textAlign: "right" },
  colUnit: { width: "18%", textAlign: "right" },
  colAmt: { width: "18%", textAlign: "right" },

  // 合計欄
  totals: { alignItems: "flex-end", marginBottom: 14 },
  totalLine: { flexDirection: "row", width: "50%", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 8.5, color: C.mid },
  totalValue: { fontSize: 8.5, color: C.body, fontFamily: "NotoSansJP", fontWeight: "bold" },
  totalGrand: { borderTopWidth: 1, borderTopColor: C.line, marginTop: 3, paddingTop: 5 },

  // 振込先
  bankBox: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 12, marginBottom: 14 },
  bankLabel: { fontSize: 7, color: C.faint, marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase" },
  bankText: { fontSize: 8.5, color: C.body, marginBottom: 3 },
  bankNote: { fontSize: 7, color: C.faint, marginTop: 4 },

  noteBox: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 },
  noteLabel: { fontSize: 8, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.mid, marginBottom: 4, letterSpacing: 0.5 },
  noteText: { fontSize: 8.5, color: C.body, lineHeight: 1.6 },
});

const TYPE_LABEL: Record<string, string> = {
  ROYALTY: "月額ロイヤリティ",
  MEMBERSHIP: "加盟参画費用",
  OTHER: "その他",
};

export function GroupInvoicePDFDocument({ invoice }: { invoice: GroupInvoiceForPDF }) {
  const gc = invoice.groupCompany;

  const meta = [
    { label: "請求書番号", value: invoice.invoiceNo },
    { label: "請求日", value: fmtDate(invoice.issueDate) },
    ...(invoice.dueDate ? [{ label: "支払期限", value: fmtDate(invoice.dueDate) }] : []),
  ];

  return (
    <Document title={`請求書 ${invoice.invoiceNo}`} author="Ad Arch株式会社" creator="Ad Arch Group OS">
      <Page size="A4" style={s.page}>
        <PdfHeader title="請求書" subtitle="Invoice" />

        {/* 宛先 & メタ & 発行元 */}
        <View style={s.infoRow}>
          <View style={s.recipientBox}>
            <Text style={s.infoLabel}>請求先</Text>
            <Text style={s.infoName}>{gc.name}</Text>
            <Text style={s.infoSub}>{gc.ownerName} 御中</Text>
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
          <Text style={s.subjectText}>{invoice.title}</Text>
        </View>
        <Text style={s.subjectSub}>
          区分: {TYPE_LABEL[invoice.type] ?? invoice.type}
          {invoice.targetMonth ? `　対象月: ${invoice.targetMonth}` : ""}
        </Text>

        {/* ご請求金額 */}
        <View style={s.billRow}>
          <Text style={s.billLabel}>ご請求金額（税込）</Text>
          <Text style={s.billValue}>{fmtMoney(invoice.totalInclTax)}</Text>
        </View>

        {/* 明細 */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colName]}>品目</Text>
            <Text style={[s.th, s.colQty]}>数量</Text>
            <Text style={[s.th, s.colUnit]}>単価（税抜）</Text>
            <Text style={[s.th, s.colAmt]}>金額（税抜）</Text>
          </View>
          {invoice.items.map((it, i) => (
            <View key={i} style={s.tableRow}>
              <View style={s.colName}>
                <Text style={s.td}>{it.name}</Text>
                {it.detail ? <Text style={s.tdDetail}>{it.detail}</Text> : null}
              </View>
              <Text style={[s.td, s.colQty]}>{it.quantity}</Text>
              <Text style={[s.td, s.colUnit]}>{fmtMoney(it.unitPrice)}</Text>
              <Text style={[s.td, s.colAmt, { fontFamily: "NotoSansJP", fontWeight: "bold" }]}>{fmtMoney(it.amount)}</Text>
            </View>
          ))}
        </View>

        {/* 合計 */}
        <View style={s.totals}>
          <View style={s.totalLine}>
            <Text style={s.totalLabel}>小計（税抜）</Text>
            <Text style={s.totalValue}>{fmtMoney(invoice.subtotalExclTax)}</Text>
          </View>
          <View style={s.totalLine}>
            <Text style={s.totalLabel}>消費税（10%）</Text>
            <Text style={s.totalValue}>{fmtMoney(invoice.taxAmount)}</Text>
          </View>
          <View style={[s.totalLine, s.totalGrand]}>
            <Text style={[s.totalLabel, { color: C.accent, fontFamily: "NotoSansJP", fontWeight: "bold" }]}>合計（税込）</Text>
            <Text style={[s.totalValue, { color: C.accent, fontSize: 11 }]}>{fmtMoney(invoice.totalInclTax)}</Text>
          </View>
        </View>

        {/* 振込先（Ad Arch 口座） */}
        <View style={s.bankBox}>
          <Text style={s.bankLabel}>お振込先</Text>
          {BILLING_ACCOUNTS.map((a, i) => (
            <Text key={i} style={s.bankText}>
              {a.bank} {a.branch} / {a.type} {a.number} / {a.holder}
            </Text>
          ))}
          <Text style={s.bankNote}>※ 振込手数料は貴社にてご負担をお願いいたします。いずれかの口座へお振込みください。</Text>
        </View>

        {/* 備考 */}
        {invoice.description && (
          <View style={s.noteBox}>
            <Text style={s.noteLabel}>備考</Text>
            <Text style={s.noteText}>{invoice.description}</Text>
          </View>
        )}

        <PdfFooter label="Ad Arch株式会社 — 請求書" />
      </Page>
    </Document>
  );
}
