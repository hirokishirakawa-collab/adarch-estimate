// このファイルはサーバー専用（API ルートから呼び出す）
// @react-pdf/renderer は Node.js でのみ動作します

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
// 日本語フォント登録
// ----------------------------------------------------------------
Font.register({
  family: "NotoSansJP",
  src: path.join(process.cwd(), "public/fonts/NotoSansJP.ttf"),
});

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
// ヘルパー
// ----------------------------------------------------------------
function toNum(v: { toNumber: () => number } | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber();
}

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
const TEAL = "#0f766e";
const GRAY_DARK = "#1a1a1a";
const GRAY_MID = "#6b7280";
const GRAY_LIGHT = "#f4f4f5";
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

  // ── ヘッダー行（左: 宛名ブロック, 右: メタ情報）
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  titleBlock: { flexDirection: "column" },
  titleMain: { fontSize: 22, fontFamily: "NotoSansJP", color: TEAL, fontWeight: "bold" },
  titleSub: { fontSize: 8, color: GRAY_MID, marginTop: 3 },

  metaBlock: { alignItems: "flex-end" },
  metaLine: { flexDirection: "row", gap: 6, marginBottom: 3 },
  metaLabel: { fontSize: 8, color: GRAY_MID, width: 54, textAlign: "right" },
  metaValue: { fontSize: 8, color: GRAY_DARK },

  // ── 区切り線
  divider: { borderBottomWidth: 1, borderBottomColor: TEAL, marginBottom: 16 },

  // ── 宛名ブロック
  addressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  addressBlock: { flexDirection: "column" },
  addressTo: { fontSize: 16, fontFamily: "NotoSansJP", color: GRAY_DARK, marginBottom: 4 },
  addressLine: { fontSize: 8, color: GRAY_MID },
  greetingText: { fontSize: 8.5, color: GRAY_MID, marginTop: 4 },

  companyBlock: { alignItems: "flex-end" },
  companyName: { fontSize: 11, fontFamily: "NotoSansJP", color: GRAY_DARK },
  companyDetail: { fontSize: 7.5, color: GRAY_MID, marginTop: 2 },

  // ── 明細テーブル
  tableContainer: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: TEAL,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: GRAY_BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: { backgroundColor: GRAY_LIGHT },
  thText: { fontSize: 8, color: "#ffffff", fontFamily: "NotoSansJP" },
  tdText: { fontSize: 8.5, color: GRAY_DARK },

  // 列幅
  colName:   { width: "28%" },
  colSpec:   { width: "32%" },
  colQty:    { width: "8%",  textAlign: "right" },
  colUnit:   { width: "7%",  textAlign: "center" },
  colPrice:  { width: "12%", textAlign: "right" },
  colAmount: { width: "13%", textAlign: "right" },

  // ── 合計エリア
  totalsContainer: { alignItems: "flex-end", marginBottom: 16 },
  totalRow: { flexDirection: "row", marginBottom: 3 },
  totalLabel: { fontSize: 8.5, color: GRAY_MID, width: 88, textAlign: "right", marginRight: 8 },
  totalValue: { fontSize: 8.5, color: GRAY_DARK, width: 80, textAlign: "right" },
  totalDivider: { borderBottomWidth: 1, borderBottomColor: GRAY_BORDER, width: 180, marginBottom: 4, marginTop: 4 },
  grandTotalLabel: { fontSize: 11, fontFamily: "NotoSansJP", color: TEAL, width: 88, textAlign: "right", marginRight: 8 },
  grandTotalValue: { fontSize: 11, fontFamily: "NotoSansJP", color: TEAL, width: 80, textAlign: "right" },

  // ── 備考
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: GRAY_BORDER,
    paddingTop: 10,
    marginTop: 4,
  },
  notesLabel: { fontSize: 8, color: GRAY_MID, marginBottom: 4 },
  notesText: { fontSize: 8.5, color: GRAY_DARK, lineHeight: 1.6 },

  // ── フッター
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
  const subtotal     = items.reduce((s, it) => s + toNum(it.amount), 0);
  const discountAmt  = toNum(rawDiscount);
  const afterDisc    = Math.max(0, subtotal - discountAmt);
  const tax          = Math.round(afterDisc * 0.1);
  const total        = afterDisc + tax;

  const hasDiscount  = discountAmt > 0;
  const customerName = customer?.name ?? null;

  return (
    <Document title={title} author="Ad-Arch Group OS" creator="Ad-Arch Group OS">
      <Page size="A4" style={s.page}>

        {/* ── ヘッダー */}
        <View style={s.headerRow}>
          <View style={s.titleBlock}>
            <Text style={s.titleMain}>見 積 書</Text>
            <Text style={s.titleSub}>ESTIMATE</Text>
          </View>
          <View style={s.metaBlock}>
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>見積番号</Text>
              <Text style={s.metaValue}>{id.slice(-10).toUpperCase()}</Text>
            </View>
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>見積日</Text>
              <Text style={s.metaValue}>{fmtDate(estimateDate)}</Text>
            </View>
            {validUntil && (
              <View style={s.metaLine}>
                <Text style={s.metaLabel}>有効期限</Text>
                <Text style={s.metaValue}>{fmtDate(validUntil)}</Text>
              </View>
            )}
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>担当者</Text>
              <Text style={s.metaValue}>{staffName ?? "—"}</Text>
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── 宛名 + 発行元 */}
        <View style={s.addressRow}>
          <View style={s.addressBlock}>
            <Text style={s.addressTo}>
              {customerName ? `${customerName} 御中` : "　"}
            </Text>
            <Text style={s.greetingText}>
              下記の通りお見積もり申し上げます。
            </Text>
          </View>
          <View style={s.companyBlock}>
            <Text style={s.companyName}>株式会社 Ad-Arch</Text>
            <Text style={s.companyDetail}>Ad-Arch Group OS</Text>
            <Text style={s.companyDetail}>info@adarch.co.jp</Text>
          </View>
        </View>

        {/* ── 件名 */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 10.5, fontFamily: "NotoSansJP", color: GRAY_DARK }}>
            {title}
          </Text>
        </View>

        {/* ── 明細テーブル */}
        <View style={s.tableContainer}>
          {/* ヘッダー行 */}
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.colName]}>品目名</Text>
            <Text style={[s.thText, s.colSpec]}>仕様・備考</Text>
            <Text style={[s.thText, s.colQty]}>数量</Text>
            <Text style={[s.thText, s.colUnit]}>単位</Text>
            <Text style={[s.thText, s.colPrice]}>単価</Text>
            <Text style={[s.thText, s.colAmount]}>金額</Text>
          </View>

          {/* 明細行 */}
          {items.map((item, idx) => (
            <View
              key={item.id}
              style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}
            >
              <Text style={[s.tdText, s.colName]}>{item.name}</Text>
              <Text style={[s.tdText, s.colSpec, { color: GRAY_MID }]}>
                {item.spec ?? ""}
              </Text>
              <Text style={[s.tdText, s.colQty]}>{item.quantity}</Text>
              <Text style={[s.tdText, s.colUnit]}>{item.unit ?? ""}</Text>
              <Text style={[s.tdText, s.colPrice]}>
                {fmtMoney(toNum(item.unitPrice))}
              </Text>
              <Text style={[s.tdText, s.colAmount]}>
                {fmtMoney(toNum(item.amount))}
              </Text>
            </View>
          ))}
        </View>

        {/* ── 合計 */}
        <View style={s.totalsContainer}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>小計（税抜）</Text>
            <Text style={s.totalValue}>{fmtMoney(subtotal)}</Text>
          </View>

          {hasDiscount && (
            <>
              <View style={s.totalRow}>
                <Text style={[s.totalLabel, { color: "#ea580c" }]}>出精値引き</Text>
                <Text style={[s.totalValue, { color: "#ea580c" }]}>
                  −{fmtMoney(discountAmt)}
                </Text>
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

          <View style={s.totalRow}>
            <Text style={s.grandTotalLabel}>合計（税込）</Text>
            <Text style={s.grandTotalValue}>{fmtMoney(total)}</Text>
          </View>
        </View>

        {/* ── 備考 */}
        {notes && (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>備考</Text>
            <Text style={s.notesText}>{notes}</Text>
          </View>
        )}

        {/* ── フッター */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Ad-Arch Group OS — 見積書</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
        </View>

      </Page>
    </Document>
  );
}
