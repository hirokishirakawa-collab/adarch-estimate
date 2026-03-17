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

// ── フォント登録（NotoSansJP Variable → Regular / Bold）──
const fontPath = path.join(process.cwd(), "public/fonts/NotoSansJP.ttf");
Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: fontPath, fontWeight: "normal" },
    { src: fontPath, fontWeight: "bold" },
  ],
});

// ── 型定義 ──
export interface ReachPotential {
  tverAudience: number;   // TVer視聴者数
  reachPotential: number; // 推定リーチ
  fillRate: number;       // 充足度 (0-100)
  totalPop: number;       // 対象人口
  plays: number;          // 再生回数
  frequency: number;      // FQ
}

export interface StoreEntry {
  name: string;
  brand: string;
  pref: string;
  city: string;
}

export interface SimulatorPDFData {
  simulatorName: string;
  totalAmount: number;
  taxRate?: number;
  notes?: string;
  conditions?: string[];
  date?: string;
  reach?: ReachPotential;
  stores?: StoreEntry[];
}

// ── ヘルパー ──
function fmtDate(d?: string): string {
  const date = d ? new Date(d) : new Date();
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function addDays(d: string | undefined, days: number): string {
  const base = d ? new Date(d) : new Date();
  base.setDate(base.getDate() + days);
  return fmtDate(base.toISOString());
}

function fmtMoney(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function fmtCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n.toLocaleString("ja-JP");
}

// ── カラー ──
const TEAL = "#0f766e";
const GRAY_DARK = "#1a1a1a";
const GRAY_MID = "#6b7280";
const GRAY_BORDER = "#e4e4e7";

// ── スタイル ──
const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: GRAY_DARK,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 44,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  titleBlock: { flexDirection: "column" },
  titleMain: { fontSize: 24, fontFamily: "NotoSansJP", fontWeight: "bold", color: TEAL },
  titleSub: { fontSize: 9, color: GRAY_MID, marginTop: 3 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { flexDirection: "row", gap: 8, marginBottom: 4 },
  metaLabel: { fontSize: 9, color: GRAY_MID, width: 60, textAlign: "right" },
  metaValue: { fontSize: 9, color: GRAY_DARK },
  divider: { borderBottomWidth: 1.5, borderBottomColor: TEAL, marginBottom: 20 },

  addressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  addressBlock: { flexDirection: "column" },
  addressTo: { fontSize: 15, fontFamily: "NotoSansJP", fontWeight: "bold", color: GRAY_DARK, marginBottom: 4 },
  greetingText: { fontSize: 9.5, color: GRAY_MID, marginTop: 4, lineHeight: 1.5 },
  companyBlock: { alignItems: "flex-end" },
  companyName: { fontSize: 12, fontFamily: "NotoSansJP", fontWeight: "bold", color: GRAY_DARK },
  companyDetail: { fontSize: 8.5, color: GRAY_MID, marginTop: 2 },

  subjectSection: { marginBottom: 24 },
  subjectText: { fontSize: 12, fontFamily: "NotoSansJP", fontWeight: "bold", color: GRAY_DARK },

  conditionsSection: { marginBottom: 20 },
  conditionsLabel: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: GRAY_MID, marginBottom: 6 },
  conditionRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  conditionDot: { fontSize: 9, color: TEAL },
  conditionText: { fontSize: 10, color: GRAY_DARK },

  totalSection: {
    marginTop: 8,
    marginBottom: 24,
    padding: 24,
    backgroundColor: "#f0fdfa",
    borderWidth: 1.5,
    borderColor: TEAL,
    borderRadius: 6,
    alignItems: "center",
  },
  totalLabel: { fontSize: 11, color: GRAY_MID, marginBottom: 10 },
  totalAmount: { fontSize: 32, fontFamily: "NotoSansJP", fontWeight: "bold", color: TEAL },
  totalTaxNote: { fontSize: 10, color: GRAY_MID, marginTop: 6 },
  taxLine: { flexDirection: "row", gap: 24, marginTop: 10 },
  taxItem: { fontSize: 10, color: GRAY_DARK },

  // リーチセクション（TVer用）
  reachSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    borderRadius: 6,
  },
  reachTitle: { fontSize: 10, fontFamily: "NotoSansJP", fontWeight: "bold", color: GRAY_DARK, marginBottom: 10 },
  reachGrid: { flexDirection: "row", gap: 16 },
  reachCard: {
    flex: 1,
    padding: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    borderRadius: 4,
    alignItems: "center",
  },
  reachCardLabel: { fontSize: 8.5, color: GRAY_MID, marginBottom: 4 },
  reachCardValue: { fontSize: 14, fontFamily: "NotoSansJP", fontWeight: "bold", color: TEAL },
  reachCardUnit: { fontSize: 8.5, color: GRAY_MID, marginTop: 2 },
  fillBarContainer: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fillBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 5,
    overflow: "hidden",
  },
  fillBarFill: {
    height: 10,
    borderRadius: 5,
  },
  fillBarLabel: { fontSize: 9, color: GRAY_MID, width: 100 },
  fillBarValue: { fontSize: 11, fontFamily: "NotoSansJP", fontWeight: "bold", width: 40, textAlign: "right" },

  // 店舗一覧
  storesSection: { marginBottom: 16 },
  storesTitle: { fontSize: 10, fontFamily: "NotoSansJP", fontWeight: "bold", color: GRAY_DARK, marginBottom: 8 },
  storesPrefGroup: { marginBottom: 6 },
  storesPrefLabel: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: TEAL, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: GRAY_BORDER },
  storesRow: { flexDirection: "row", paddingVertical: 2, paddingHorizontal: 4 },
  storesRowAlt: { backgroundColor: "#f9fafb" },
  storesCell: { fontSize: 8.5, color: GRAY_DARK },
  storesCellBrand: { fontSize: 8, color: GRAY_MID, width: 60 },
  storesCellName: { fontSize: 8.5, color: GRAY_DARK, flex: 1 },
  storesCellCity: { fontSize: 8, color: GRAY_MID, width: 80, textAlign: "right" },

  notesSection: {
    borderTopWidth: 1,
    borderTopColor: GRAY_BORDER,
    paddingTop: 12,
    marginTop: 4,
  },
  notesLabel: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: GRAY_MID, marginBottom: 4 },
  notesText: { fontSize: 9.5, color: GRAY_DARK, lineHeight: 1.7 },

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
  footerText: { fontSize: 7.5, color: GRAY_MID },
});

// ── PDF ドキュメント ──
export function SimulatorPDFDocument({ data }: { data: SimulatorPDFData }) {
  const taxRate = data.taxRate ?? 0.10;
  const tax = Math.round(data.totalAmount * taxRate);
  const totalWithTax = data.totalAmount + tax;

  return (
    <Document title={`${data.simulatorName} 概算見積`} author="Ad-Arch Group">
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
            <View style={s.metaLine}>
              <Text style={s.metaLabel}>有効期限</Text>
              <Text style={s.metaValue}>{addDays(data.date, 10)}</Text>
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
            <Text style={s.companyName}>Ad-Arch Group</Text>
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

        {/* リーチポテンシャル（TVer用） */}
        {data.reach && (
          <View style={s.reachSection}>
            <Text style={s.reachTitle}>リーチポテンシャル</Text>
            <View style={s.reachGrid}>
              <View style={s.reachCard}>
                <Text style={s.reachCardLabel}>対象人口</Text>
                <Text style={s.reachCardValue}>{fmtCount(data.reach.totalPop)}</Text>
                <Text style={s.reachCardUnit}>人</Text>
              </View>
              <View style={s.reachCard}>
                <Text style={s.reachCardLabel}>TVer視聴者数</Text>
                <Text style={s.reachCardValue}>{fmtCount(data.reach.tverAudience)}</Text>
                <Text style={s.reachCardUnit}>人（普及率30%）</Text>
              </View>
              <View style={s.reachCard}>
                <Text style={s.reachCardLabel}>推定リーチ</Text>
                <Text style={s.reachCardValue}>{fmtCount(data.reach.reachPotential)}</Text>
                <Text style={s.reachCardUnit}>人（FQ {data.reach.frequency}回）</Text>
              </View>
            </View>
            <View style={s.fillBarContainer}>
              <Text style={s.fillBarLabel}>配信ボリューム充足度</Text>
              <View style={s.fillBarBg}>
                <View
                  style={[
                    s.fillBarFill,
                    {
                      width: `${Math.min(100, data.reach.fillRate)}%`,
                      backgroundColor:
                        data.reach.fillRate >= 80 ? "#34d399" :
                        data.reach.fillRate >= 40 ? "#fbbf24" : "#94a3b8",
                    },
                  ]}
                />
              </View>
              <Text style={[
                s.fillBarValue,
                {
                  color:
                    data.reach.fillRate >= 80 ? "#059669" :
                    data.reach.fillRate >= 40 ? "#d97706" : GRAY_MID,
                },
              ]}>
                {data.reach.fillRate}%
              </Text>
            </View>
          </View>
        )}

        {/* 店舗一覧 */}
        {data.stores && data.stores.length > 0 && (() => {
          // 都道府県でグループ化
          const grouped = new Map<string, typeof data.stores>();
          for (const store of data.stores!) {
            if (!grouped.has(store.pref)) grouped.set(store.pref, []);
            grouped.get(store.pref)!.push(store);
          }
          let rowIdx = 0;
          return (
            <View style={s.storesSection} break>
              <Text style={s.storesTitle}>対象店舗一覧（{data.stores!.length}店舗）</Text>
              {Array.from(grouped.entries()).map(([pref, stores]) => (
                <View key={pref} style={s.storesPrefGroup} wrap={false}>
                  <Text style={s.storesPrefLabel}>{pref}（{stores!.length}店舗）</Text>
                  {stores!.map((store) => {
                    const alt = rowIdx++ % 2 === 1;
                    return (
                      <View key={store.name + store.brand} style={[s.storesRow, alt ? s.storesRowAlt : {}]}>
                        <Text style={s.storesCellBrand}>{store.brand}</Text>
                        <Text style={s.storesCellName}>{store.name}</Text>
                        <Text style={s.storesCellCity}>{store.city}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })()}

        {/* 備考 */}
        <View style={s.notesSection}>
          <Text style={s.notesLabel}>備考</Text>
          <Text style={s.notesText}>
            {data.notes ?? "本見積は概算であり、正式な発注時に詳細なお見積もりを改めてご提出いたします。\n金額は予告なく変更される場合がございます。"}
          </Text>
        </View>

        {/* フッター */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Ad-Arch Group — {data.simulatorName} 概算見積</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
        </View>

      </Page>
    </Document>
  );
}
