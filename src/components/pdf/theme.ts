// 全PDF共通のデザイントークン・会社情報・ヘルパー・フォント登録
// このファイルはサーバー専用（@react-pdf/renderer は Node.js でのみ動作）
import { Font } from "@react-pdf/renderer";
import path from "path";

// ----------------------------------------------------------------
// 日本語フォント登録（全PDF共通・Regular/Bold を正しく使い分け）
//   ※ 以前は各PDFが単一TTFを登録しており bold が効いていなかった
// ----------------------------------------------------------------
const fontDir = path.join(process.cwd(), "public/fonts");
Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: path.join(fontDir, "NotoSansJP-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(fontDir, "NotoSansJP-Bold.ttf"), fontWeight: "bold" },
  ],
});

// 日本語の折り返し制御:
//   語に分割点を与えない（=ハイフネーションさせない）。これにより、既定の英文
//   ハイフネーションが日本語の折り返し位置へ挿入してしまう不要な「-」を防ぐ。
//   長い日本語はreact-pdf側がハイフンなしで文字単位に強制折り返しする。
Font.registerHyphenationCallback((word) => [word]);

// ----------------------------------------------------------------
// カラートークン（モノクロ基調 ＋ インクネイビー1色アクセント）
// ----------------------------------------------------------------
export const C = {
  ink: "#111111", // 主要テキスト・強い見出し
  body: "#1f2024", // 本文
  mid: "#6b7280", // 補助テキスト
  faint: "#9ca3af", // 最も弱いテキスト・ラベル
  accent: "#1e3a5f", // インクネイビー（見出し/合計/罫線/帯）
  accentSoft: "#f3f5f9", // アクセントの淡い背景
  line: "#e5e7eb", // 罫線
  lineSoft: "#f0f1f3", // 薄い罫線
  rowAlt: "#f8f9fb", // 明細の交互背景
  white: "#ffffff",
} as const;

// ----------------------------------------------------------------
// 会社情報（全PDF統一・正式名称は「Ad Arch株式会社」）
// ----------------------------------------------------------------
export const COMPANY = {
  name: "Ad Arch株式会社",
  postalCode: "〒107-0062",
  address1: "東京都港区南青山2-15-5",
  address2: "FARO1F",
  email: "info@adarch.co.jp",
} as const;

// ----------------------------------------------------------------
// ロゴ（黒ワードマーク・元画像 600×150 = 4:1）
// ----------------------------------------------------------------
export const LOGO_PATH = path.join(process.cwd(), "public/logo-adarch.png");
export const LOGO_W = 88;
export const LOGO_H = 22;

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------
type Decimalish = { toNumber: () => number } | number | null | undefined;

export function toNum(v: Decimalish): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber();
}

export function fmtMoney(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(d));
}
