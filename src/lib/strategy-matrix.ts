// ================================================================
// アドアーチ 戦略マトリクス
// 各媒体の特性・最低予算・スコアを定義する静的データ
// ================================================================

export type MediaId =
  | "tver"
  | "skylark"
  | "aeon-cinema"
  | "taxi"
  | "golfcart"
  | "omochannel";

export interface MediaDef {
  id: MediaId;
  name: string;
  emoji: string;
  /** ダッシュボード内シミュレーターのパス */
  simulatorPath: string;
  /** 最低推奨予算（円） */
  minBudget: number;
  /** 4週間の推奨予算（円） */
  recommendedBudget: number;

  targetFit: {
    /** 0=不向き … 5=最適 */
    male: number;
    female: number;
    ageRange: string;
    /** ビジネス層スコア */
    businessLayer: number;
    /** インバウンドスコア */
    inbound: number;
  };

  purposeScore: {
    /** 認知拡大 */
    awareness: number;
    /** 理解促進 */
    understanding: number;
    /** 来店・販売促進 */
    conversion: number;
    /** ブランドリフト */
    brandlift: number;
    /** 採用 */
    recruitment: number;
  };

  areaSupport: {
    nationwide: boolean;
    regional: boolean;
    municipal: boolean;
  };

  description: string;
  strengths: string[];
  considerations: string[];
}

export const MEDIA_MATRIX: Record<MediaId, MediaDef> = {
  tver: {
    id: "tver",
    name: "TVer",
    emoji: "📺",
    simulatorPath: "/dashboard/tver-simulator",
    minBudget: 500_000,
    recommendedBudget: 2_000_000,
    targetFit: {
      male: 4,
      female: 4,
      ageRange: "10〜50代",
      businessLayer: 2,
      inbound: 1,
    },
    purposeScore: {
      awareness: 5,
      understanding: 4,
      conversion: 3,
      brandlift: 5,
      recruitment: 3,
    },
    areaSupport: { nationwide: true, regional: true, municipal: true },
    description:
      "日本最大の無料動画配信プラットフォーム。月間アクティブユーザー3,000万超。",
    strengths: [
      "動画×視聴完了率の高いブランド接触",
      "エリア・ジャンルによる精緻なターゲティング",
      "視聴ログによる効果測定が可能",
    ],
    considerations: [
      "最低予算50万円〜",
      "15秒 or 30秒の動画素材が必要",
    ],
  },

  skylark: {
    id: "skylark",
    name: "すかいらーく インストア",
    emoji: "🍽️",
    simulatorPath: "/dashboard/skylark-simulator",
    minBudget: 750_000,
    recommendedBudget: 2_500_000,
    targetFit: {
      male: 3,
      female: 4,
      ageRange: "30〜60代",
      businessLayer: 2,
      inbound: 2,
    },
    purposeScore: {
      awareness: 4,
      understanding: 5,
      conversion: 3,
      brandlift: 3,
      recruitment: 3,
    },
    areaSupport: { nationwide: true, regional: true, municipal: true },
    description:
      "ガスト・バーミヤン等すかいらーくグループ3,000店舗のデジタルサイネージ広告。",
    strengths: [
      "食事中の長時間接触（平均20〜40分）",
      "全国3,000店舗・エリア絞り込み自在",
      "リピーター多く繰り返し接触が生まれる",
    ],
    considerations: [
      "最低100店舗〜（約75万円/週）",
      "静止画・動画コンテンツの用意が必要",
    ],
  },

  "aeon-cinema": {
    id: "aeon-cinema",
    name: "イオンシネマ",
    emoji: "🎬",
    simulatorPath: "/dashboard/aeon-cinema-simulator",
    minBudget: 300_000,
    recommendedBudget: 1_500_000,
    targetFit: {
      male: 3,
      female: 4,
      ageRange: "20〜50代",
      businessLayer: 2,
      inbound: 2,
    },
    purposeScore: {
      awareness: 4,
      understanding: 5,
      conversion: 3,
      brandlift: 5,
      recruitment: 3,
    },
    areaSupport: { nationwide: true, regional: true, municipal: true },
    description: "全国180劇場超のイオンシネマでの本編前スクリーン広告。",
    strengths: [
      "強制視聴（スキップ不可・暗室集中）で高い記憶定着",
      "ブランドの「格」が上がる体験型接触",
      "ファミリー・カップル層への高品質接触",
    ],
    considerations: [
      "最低数劇場〜（30万円〜）",
      "15秒 or 30秒の動画素材が必要",
    ],
  },

  taxi: {
    id: "taxi",
    name: "タクシー（Tokyo Prime）",
    emoji: "🚕",
    simulatorPath: "/dashboard/taxi-ads-simulator",
    minBudget: 1_000_000,
    recommendedBudget: 4_000_000,
    targetFit: {
      male: 4,
      female: 3,
      ageRange: "30〜60代",
      businessLayer: 5,
      inbound: 3,
    },
    purposeScore: {
      awareness: 4,
      understanding: 5,
      conversion: 3,
      brandlift: 5,
      recruitment: 5,
    },
    areaSupport: { nationwide: false, regional: true, municipal: false },
    description:
      "東京・大阪等のタクシータブレット広告。乗車中の高収入ビジネス層へ届く。",
    strengths: [
      "乗車中の「逃げ場なし」接触（平均18分）",
      "BtoB・高額商品・採用に特化した媒体",
      "決裁層・管理職への直接リーチ",
    ],
    considerations: [
      "最低100万円/週〜（HALF）",
      "主に東京・大阪・名古屋エリア",
    ],
  },

  golfcart: {
    id: "golfcart",
    name: "ゴルフカート（Golfcart Vision）",
    emoji: "⛳",
    simulatorPath: "/dashboard/golfcart-simulator",
    minBudget: 300_000,
    recommendedBudget: 1_200_000,
    targetFit: {
      male: 5,
      female: 2,
      ageRange: "40〜70代",
      businessLayer: 5,
      inbound: 3,
    },
    purposeScore: {
      awareness: 3,
      understanding: 4,
      conversion: 4,
      brandlift: 5,
      recruitment: 3,
    },
    areaSupport: { nationwide: true, regional: true, municipal: false },
    description:
      "全国ゴルフ場のカートモニター広告。経営者・富裕層へのリーチ日本随一。",
    strengths: [
      "経営者・富裕層への直接リーチ",
      "1ラウンド18ホールで繰り返し接触（閉鎖空間）",
      "競合が少なく差別化しやすい",
    ],
    considerations: [
      "最低6ゴルフ場〜（30万円/週）",
      "男性比率が高い（約85%）",
    ],
  },

  omochannel: {
    id: "omochannel",
    name: "おもチャンネル（アパホテル）",
    emoji: "🏨",
    simulatorPath: "/dashboard/omochannel-simulator",
    minBudget: 2_000_000,
    recommendedBudget: 3_200_000,
    targetFit: {
      male: 3,
      female: 3,
      ageRange: "20〜60代",
      businessLayer: 3,
      inbound: 5,
    },
    purposeScore: {
      awareness: 4,
      understanding: 5,
      conversion: 4,
      brandlift: 4,
      recruitment: 2,
    },
    areaSupport: { nationwide: true, regional: true, municipal: false },
    description:
      "全国アパホテル全52,963室のVOD広告。インバウンド向けリーチで国内最高水準。",
    strengths: [
      "インバウンド向けでNo.1のリーチ力",
      "ホテル滞在中の「ゆったり時間」に長尺視聴",
      "国内・インバウンドでターゲット切り替え可能",
    ],
    considerations: [
      "最低200万円/月〜（1話）",
      "30秒動画コンテンツの用意が必要",
    ],
  },
};

/** 媒体IDの表示順 */
export const MEDIA_ORDER: MediaId[] = [
  "tver",
  "skylark",
  "aeon-cinema",
  "taxi",
  "golfcart",
  "omochannel",
];
