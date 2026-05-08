// サーバー専用 — API ルートから呼び出す
// @react-pdf/renderer は Node.js でのみ動作

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";

// ----------------------------------------------------------------
// 日本語フォント
// ----------------------------------------------------------------
Font.register({
  family: "NotoSansJP",
  src: path.join(process.cwd(), "public/fonts/NotoSansJP.ttf"),
});

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
// ヘルパー
// ----------------------------------------------------------------
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(d));
}

function fmtMoney(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

// ----------------------------------------------------------------
// スタイル
// ----------------------------------------------------------------
const NAVY = "#1e3a5f";
const GOLD = "#b8860b";
const GRAY_DARK = "#1a1a1a";
const GRAY_MID = "#6b7280";
const GRAY_LIGHT = "#f8f9fa";
const GRAY_BORDER = "#e4e4e7";

const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: GRAY_DARK,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  // ヘッダー
  header: {
    borderBottom: `2px solid ${NAVY}`,
    paddingBottom: 12,
    marginBottom: 20,
  },
  docTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: NAVY,
    letterSpacing: 2,
  },
  docSubtitle: {
    fontSize: 8,
    color: GRAY_MID,
    marginTop: 4,
  },
  // 宛先 & 発行元
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoBox: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 7,
    color: GRAY_MID,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  infoName: {
    fontSize: 12,
    fontWeight: "bold",
    color: GRAY_DARK,
  },
  infoSub: {
    fontSize: 8,
    color: GRAY_MID,
    marginTop: 2,
  },
  // 金額テーブル
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY,
    color: "white",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "white",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `1px solid ${GRAY_BORDER}`,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  tableRowAlt: {
    backgroundColor: GRAY_LIGHT,
  },
  tableRowTotal: {
    flexDirection: "row",
    backgroundColor: NAVY,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  colLabel: { width: "65%" },
  colAmount: { width: "35%", textAlign: "right" as const },
  totalText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "white",
  },
  // 振込先
  bankBox: {
    border: `1px solid ${GRAY_BORDER}`,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  bankLabel: {
    fontSize: 7,
    color: GRAY_MID,
    marginBottom: 4,
    letterSpacing: 1,
  },
  bankText: {
    fontSize: 9,
    color: GRAY_DARK,
  },
  // 備考
  noteBox: {
    borderTop: `1px solid ${GRAY_BORDER}`,
    paddingTop: 8,
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 7,
    color: GRAY_MID,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 8,
    color: GRAY_DARK,
  },
  // フッター
  footer: {
    position: "absolute" as const,
    bottom: 30,
    left: 50,
    right: 50,
    borderTop: `1px solid ${GOLD}`,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: GRAY_MID,
  },
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
  const rows: { label: string; amount: number; isDeduction?: boolean }[] = [
    { label: "クライアント入金額（税込）", amount: statement.grossAmount },
    {
      label: `本部手数料（${statement.commissionRate}%）`,
      amount: -statement.commissionAmount,
      isDeduction: true,
    },
  ];
  if (statement.mediaExpense > 0) {
    rows.push({ label: "うち媒体費（税抜・源泉対象外）", amount: statement.mediaExpense });
  }
  if (statement.productionExpense > 0) {
    rows.push({ label: "うち制作費（税抜・源泉対象）", amount: statement.productionExpense });
  }
  if (statement.withholdingTaxAmount > 0) {
    rows.push({
      label: "源泉徴収税",
      amount: -statement.withholdingTaxAmount,
      isDeduction: true,
    });
  }
  if (statement.nonDeductibleTaxAmount > 0) {
    rows.push({
      label: "控除不可消費税（インボイス未登録）",
      amount: -statement.nonDeductibleTaxAmount,
      isDeduction: true,
    });
  }

  const bankType = gc.bankAccountType === "SAVINGS" ? "普通" : gc.bankAccountType === "CHECKING" ? "当座" : "";

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ヘッダー */}
        <View style={s.header}>
          <Text style={s.docTitle}>支 払 明 細 書</Text>
          <Text style={s.docSubtitle}>
            発行日: {fmtDate(statement.paidAt || statement.createdAt)} / No. {statement.id.slice(-8).toUpperCase()}
          </Text>
        </View>

        {/* 宛先 & 発行元 */}
        <View style={s.infoRow}>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>お支払先</Text>
            <Text style={s.infoName}>{gc.name}</Text>
            <Text style={s.infoSub}>{gc.ownerName} 様</Text>
            <Text style={s.infoSub}>
              {gc.entityType === "SOLE_PROPRIETOR" ? "個人事業主" : gc.entityType === "CORPORATION" ? "法人" : ""} / インボイス{gc.invoiceRegistered ? "登録済" : "未登録"}
            </Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>発行元</Text>
            <Text style={s.infoName}>Ad Arch株式会社</Text>
            <Text style={s.infoSub}>〒220-0004 神奈川県横浜市西区北幸2-10-27</Text>
            <Text style={s.infoSub}>東武立川ビル5F</Text>
          </View>
        </View>

        {/* 件名 */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: "bold", color: GRAY_DARK }}>
            {statement.title}
          </Text>
          {statement.clientName && (
            <Text style={{ fontSize: 8, color: GRAY_MID, marginTop: 2 }}>
              クライアント: {statement.clientName}
            </Text>
          )}
        </View>

        {/* 金額テーブル */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.colLabel]}>項目</Text>
            <Text style={[s.tableHeaderText, s.colAmount]}>金額</Text>
          </View>
          {rows.map((row, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={s.colLabel}>{row.label}</Text>
              <Text
                style={[
                  s.colAmount,
                  { color: row.isDeduction ? "#dc2626" : GRAY_DARK, fontWeight: "bold" },
                ]}
              >
                {row.isDeduction ? fmtMoney(row.amount) : fmtMoney(row.amount)}
              </Text>
            </View>
          ))}
          {/* 合計行 */}
          <View style={s.tableRowTotal}>
            <Text style={[s.totalText, s.colLabel]}>差引支払額</Text>
            <Text style={[s.totalText, s.colAmount]}>{fmtMoney(statement.netPaymentAmount)}</Text>
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

        {/* フッター */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Ad Arch株式会社 — 支払明細書</Text>
          <Text style={s.footerText}>{fmtDate(statement.paidAt || statement.createdAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}
