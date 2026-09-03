// フィードバックの選択肢（Googleフォーム 2026-09 と同じ）。"use server" のファイルからは定数を export できないので分離
export const USABILITY_OPTIONS = ["そのまま使えた", "少し直して使えた", "かなり直した", "使えなかった"] as const;
export const USED_FOR_OPTIONS = [
  "提案メール（A）",
  "フォーム用の短文（B）",
  "チラシ・LPの見出し（C）",
  "反論への返し（D）",
  "商談後のお礼（E）",
  "自分で指示文を作った",
  "その他",
] as const;
