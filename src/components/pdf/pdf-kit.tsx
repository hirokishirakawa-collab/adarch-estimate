// 全PDF共通の見た目部品（ロゴ入りヘッダー / フッター / 発行元 / メタ情報）
// このファイルはサーバー専用（@react-pdf/renderer は Node.js でのみ動作）
import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { C, COMPANY, LOGO_PATH, LOGO_W, LOGO_H } from "./theme";

const k = StyleSheet.create({
  // ── ヘッダー（左: ロゴ / 右: 書類名）
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  logo: { width: LOGO_W, height: LOGO_H },
  titleWrap: { alignItems: "flex-end" },
  title: {
    fontSize: 19,
    fontFamily: "NotoSansJP",
    fontWeight: "bold",
    color: C.accent,
    letterSpacing: 5,
  },
  subtitle: {
    fontSize: 7,
    color: C.faint,
    letterSpacing: 3,
    marginTop: 4,
    textTransform: "uppercase",
  },

  // ── 罫線
  rule: { height: 1.2, backgroundColor: C.accent, marginBottom: 18 },
  hairline: { height: 1, backgroundColor: C.line },

  // ── 発行元ブロック
  issuer: { alignItems: "flex-end" },
  issuerName: {
    fontSize: 10.5,
    fontFamily: "NotoSansJP",
    fontWeight: "bold",
    color: C.ink,
  },
  issuerLine: { fontSize: 7.5, color: C.mid, marginTop: 2.5 },

  // ── メタ情報（見積番号・日付など）
  metaLine: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2.5 },
  metaLabel: { fontSize: 7.5, color: C.faint, marginRight: 10 },
  metaValue: { fontSize: 7.5, color: C.body, fontFamily: "NotoSansJP" },

  // ── フッター
  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 7, color: C.faint, letterSpacing: 0.5 },
});

/** ロゴ＋書類名＋アクセント罫線。書類系PDFの共通ヘッダー。 */
export function PdfHeader({
  title,
  subtitle,
  rule = true,
}: {
  title: string;
  subtitle: string;
  rule?: boolean;
}) {
  return (
    <View>
      <View style={k.headerRow}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={LOGO_PATH} style={k.logo} />
        <View style={k.titleWrap}>
          <Text style={k.title}>{title}</Text>
          <Text style={k.subtitle}>{subtitle}</Text>
        </View>
      </View>
      {rule && <View style={k.rule} />}
    </View>
  );
}

/** 発行元（Ad Arch株式会社）ブロック。 */
export function IssuerBlock({ showAddress = true }: { showAddress?: boolean }) {
  return (
    <View style={k.issuer}>
      <Text style={k.issuerName}>{COMPANY.name}</Text>
      {showAddress && (
        <>
          <Text style={k.issuerLine}>
            {COMPANY.postalCode} {COMPANY.address1}
          </Text>
          <Text style={k.issuerLine}>{COMPANY.address2}</Text>
        </>
      )}
      <Text style={k.issuerLine}>{COMPANY.email}</Text>
    </View>
  );
}

/** 右寄せのメタ情報リスト（見積番号・日付・担当者など）。 */
export function MetaList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View>
      {items.map((m, i) => (
        <View key={i} style={k.metaLine}>
          <Text style={k.metaLabel}>{m.label}</Text>
          <Text style={k.metaValue}>{m.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** 全ページ固定フッター（会社名 ＋ ページ番号）。 */
export function PdfFooter({ label }: { label: string }) {
  return (
    <View style={k.footer} fixed>
      <Text style={k.footerText}>{label}</Text>
      <Text
        style={k.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}
