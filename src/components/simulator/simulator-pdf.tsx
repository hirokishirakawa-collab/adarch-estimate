// サーバー専用 — @react-pdf/renderer は Node.js でのみ動作
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { C, fmtMoney } from "@/components/pdf/theme";
import { PdfHeader, PdfFooter, IssuerBlock, MetaList } from "@/components/pdf/pdf-kit";

// ── 型定義 ──
export interface ReachPotential {
  tverAudience: number; // TVer視聴者数
  reachPotential: number; // 推定リーチ
  fillRate: number; // 充足度 (0-100)
  totalPop: number; // 対象人口
  plays: number; // 再生回数
  frequency: number; // FQ
}

export interface StoreEntry {
  name: string; // 店舗名 or 食堂名
  brand: string; // ブランド or 大学種別（国立/私立等）
  pref: string; // 都道府県
  city: string; // 市区町村 or キャンパス
  univ?: string; // 大学名（生協用）
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

// ── ヘルパー（発行日は未指定なら本日にフォールバック） ──
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

function fmtCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n.toLocaleString("ja-JP");
}

// ── スタイル ──
const s = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: C.body,
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 44,
  },

  addressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  addressBlock: { flexDirection: "column", maxWidth: "55%" },
  addressTo: { fontSize: 15, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, marginBottom: 4 },
  greetingText: { fontSize: 9.5, color: C.mid, marginTop: 4, lineHeight: 1.5 },
  rightCol: { alignItems: "flex-end" },
  issuerSpacer: { marginTop: 12 },

  subjectRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  subjectBar: { width: 3, height: 14, backgroundColor: C.accent, marginRight: 8 },
  subjectText: { fontSize: 12, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink },

  conditionsSection: { marginBottom: 18 },
  conditionsLabel: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.mid, marginBottom: 6, letterSpacing: 0.5 },
  conditionRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  conditionDot: { fontSize: 7, color: C.accent, marginTop: 2 },
  conditionText: { fontSize: 10, color: C.body },

  totalSection: {
    marginTop: 6,
    marginBottom: 22,
    padding: 22,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 6,
    alignItems: "center",
  },
  totalLabel: { fontSize: 10.5, color: C.mid, marginBottom: 8, letterSpacing: 0.5 },
  totalAmount: { fontSize: 30, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent },
  totalTaxNote: { fontSize: 9.5, color: C.mid, marginTop: 6 },
  taxLine: { flexDirection: "row", gap: 24, marginTop: 10 },
  taxItem: { fontSize: 9.5, color: C.body },

  // リーチセクション（TVer用）
  reachSection: { marginBottom: 20, padding: 16, backgroundColor: C.rowAlt, borderWidth: 1, borderColor: C.line, borderRadius: 6 },
  reachTitle: { fontSize: 10, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, marginBottom: 10 },
  reachGrid: { flexDirection: "row", gap: 16 },
  reachCard: { flex: 1, padding: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 4, alignItems: "center" },
  reachCardLabel: { fontSize: 8.5, color: C.mid, marginBottom: 4 },
  reachCardValue: { fontSize: 14, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent },
  reachCardUnit: { fontSize: 8.5, color: C.mid, marginTop: 2 },
  fillBarContainer: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  fillBarBg: { flex: 1, height: 10, backgroundColor: "#e2e8f0", borderRadius: 5, overflow: "hidden" },
  fillBarFill: { height: 10, borderRadius: 5 },
  fillBarLabel: { fontSize: 9, color: C.mid, width: 100 },
  fillBarValue: { fontSize: 11, fontFamily: "NotoSansJP", fontWeight: "bold", width: 40, textAlign: "right" },

  // 店舗一覧
  storesSection: { marginBottom: 16 },
  storesTitle: { fontSize: 10, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink, marginBottom: 8 },
  storesPrefGroup: { marginBottom: 6 },
  storesPrefLabel: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.accent, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: C.line },
  storesRow: { flexDirection: "row", paddingVertical: 2, paddingHorizontal: 4 },
  storesRowAlt: { backgroundColor: C.rowAlt },
  storesCellBrand: { fontSize: 8, color: C.mid, width: 60 },
  storesCellName: { fontSize: 8.5, color: C.body, flex: 1 },
  storesCellCity: { fontSize: 8, color: C.mid, width: 80, textAlign: "right" },

  notesSection: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, marginTop: 4 },
  notesLabel: { fontSize: 9, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.mid, marginBottom: 4, letterSpacing: 0.5 },
  notesText: { fontSize: 9.5, color: C.body, lineHeight: 1.7 },
});

// ── PDF ドキュメント ──
export function SimulatorPDFDocument({ data }: { data: SimulatorPDFData }) {
  const taxRate = data.taxRate ?? 0.1;
  const tax = Math.round(data.totalAmount * taxRate);
  const totalWithTax = data.totalAmount + tax;

  const meta = [
    { label: "発行日", value: fmtDate(data.date) },
    { label: "有効期限", value: addDays(data.date, 10) },
  ];

  return (
    <Document title={`${data.simulatorName} 概算見積`} author="Ad Arch株式会社" creator="Ad Arch Group OS">
      <Page size="A4" style={s.page}>
        <PdfHeader title="概 算 見 積" subtitle="Estimate" />

        {/* 宛名 + メタ + 発行元 */}
        <View style={s.addressRow}>
          <View style={s.addressBlock}>
            <Text style={s.addressTo}>御中</Text>
            <Text style={s.greetingText}>下記の通り概算をお見積もり申し上げます。</Text>
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
                        data.reach.fillRate >= 80 ? "#34d399" : data.reach.fillRate >= 40 ? "#fbbf24" : "#94a3b8",
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  s.fillBarValue,
                  {
                    color:
                      data.reach.fillRate >= 80 ? "#059669" : data.reach.fillRate >= 40 ? "#d97706" : C.mid,
                  },
                ]}
              >
                {data.reach.fillRate}%
              </Text>
            </View>
          </View>
        )}

        {/* 店舗一覧 */}
        {data.stores && data.stores.length > 0 && (() => {
          const hasUniv = data.stores!.some((st) => st.univ);
          // 都道府県でグループ化
          const grouped = new Map<string, typeof data.stores>();
          for (const store of data.stores!) {
            if (!grouped.has(store.pref)) grouped.set(store.pref, []);
            grouped.get(store.pref)!.push(store);
          }
          let rowIdx = 0;
          return (
            <View style={s.storesSection} break>
              <Text style={s.storesTitle}>
                {hasUniv ? `対象食堂一覧（${data.stores!.length}食堂）` : `対象店舗一覧（${data.stores!.length}店舗）`}
              </Text>
              {Array.from(grouped.entries()).map(([pref, stores]) => {
                if (hasUniv) {
                  // 大学別にサブグループ化
                  const univMap = new Map<string, typeof stores>();
                  for (const st of stores!) {
                    const key = st.univ ?? st.name;
                    if (!univMap.has(key)) univMap.set(key, []);
                    univMap.get(key)!.push(st);
                  }
                  return (
                    <View key={pref} style={s.storesPrefGroup}>
                      <Text style={s.storesPrefLabel}>{pref}（{stores!.length}食堂）</Text>
                      {Array.from(univMap.entries()).map(([univ, univStores]) => (
                        <View key={univ} wrap={false} style={{ marginBottom: 4 }}>
                          <View style={{ flexDirection: "row", gap: 6, marginBottom: 2, paddingLeft: 4 }}>
                            <Text style={{ fontSize: 8.5, fontFamily: "NotoSansJP", fontWeight: "bold", color: C.ink }}>{univ}</Text>
                            <Text style={{ fontSize: 8, color: C.mid }}>({univStores!.length}食堂)</Text>
                          </View>
                          {univStores!.map((store) => {
                            const alt = rowIdx++ % 2 === 1;
                            return (
                              <View key={store.name + (store.city ?? "")} style={[s.storesRow, alt ? s.storesRowAlt : {}, { paddingLeft: 12 }]}>
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
                }
                return (
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
                );
              })}
            </View>
          );
        })()}

        {/* 備考 */}
        <View style={s.notesSection}>
          <Text style={s.notesLabel}>備考</Text>
          <Text style={s.notesText}>
            {data.notes ??
              "本見積は概算であり、正式な発注時に詳細なお見積もりを改めてご提出いたします。\n金額は予告なく変更される場合がございます。"}
          </Text>
        </View>

        <PdfFooter label={`Ad Arch株式会社 — ${data.simulatorName} 概算見積`} />
      </Page>
    </Document>
  );
}
