// ==============================================================
// 媒体データ — taxi（シミュレーターとブランドキットの共通の正本）
//   ここを直すと、シミュレーターの計算とAI用材料の両方に反映される。
// ==============================================================

export type FH = "none" | "full" | "half";

export type SecondAds = "none" | "plus_full" | "plus_half" | "full" | "half";

export type Slot = "none" | "full" | "half";

export interface AreaDef {
  id: string;
  label: string;
  prefectures: string;
  hasHalf: boolean;
  p2nd: { full: number; half: number };
  p3rd: { full: number; half: number };
  i2nd: { full: number; half: number };
  i3rd: { full: number; half: number };
}

export const AREAS: AreaDef[] = [
  { id: "tokyo",     label: "東京",   prefectures: "東京都（23区）",                                 hasHalf: true,  p2nd: { full: 7_600_000, half: 3_800_000 }, p3rd: { full: 3_200_000, half: 1_600_000 }, i2nd: { full: 1_320_000, half: 660_000   }, i3rd: { full: 970_000,  half: 485_000 } },
  { id: "kanto",     label: "関東",   prefectures: "神奈川県・埼玉県・千葉県・茨城県・栃木県・群馬県", hasHalf: false, p2nd: { full: 3_600_000, half: 0 },         p3rd: { full: 1_200_000, half: 0 },         i2nd: { full: 900_000,  half: 0 },          i3rd: { full: 485_000,  half: 0 } },
  { id: "kansai",    label: "関西",   prefectures: "大阪府・京都府・兵庫県・滋賀県・奈良県・和歌山県", hasHalf: false, p2nd: { full: 3_600_000, half: 0 },         p3rd: { full: 1_300_000, half: 0 },         i2nd: { full: 900_000,  half: 0 },          i3rd: { full: 520_000,  half: 0 } },
  { id: "tokai",     label: "東海",   prefectures: "愛知県・岐阜県・静岡県・三重県",                 hasHalf: false, p2nd: { full: 1_320_000, half: 0 },         p3rd: { full: 560_000,  half: 0 },          i2nd: { full: 330_000,  half: 0 },          i3rd: { full: 224_000,  half: 0 } },
  { id: "kyushu",    label: "九州",   prefectures: "福岡県・佐賀県・長崎県・熊本県",                 hasHalf: false, p2nd: { full: 920_000,  half: 0 },          p3rd: { full: 390_000,  half: 0 },          i2nd: { full: 230_000,  half: 0 },          i3rd: { full: 154_000,  half: 0 } },
  { id: "hokkaido",  label: "北海道", prefectures: "北海道",                                         hasHalf: false, p2nd: { full: 640_000,  half: 0 },          p3rd: { full: 200_000,  half: 0 },          i2nd: { full: 160_000,  half: 0 },          i3rd: { full: 80_000,   half: 0 } },
  { id: "hiroshima", label: "広島",   prefectures: "広島県",                                         hasHalf: false, p2nd: { full: 200_000,  half: 0 },          p3rd: { full: 98_000,   half: 0 },          i2nd: { full: 50_000,   half: 0 },          i3rd: { full: 39_000,   half: 0 } },
  { id: "okinawa",   label: "沖縄",   prefectures: "沖縄県",                                         hasHalf: false, p2nd: { full: 360_000,  half: 0 },          p3rd: { full: 200_000,  half: 0 },          i2nd: { full: 90_000,   half: 0 },          i3rd: { full: 80_000,   half: 0 } },
];

export interface TargetDef {
  id: string;
  label: string;
  category: string;
  pricePerWeek: number;
  impressionsPerWeek: number;
}

export const TARGETING: TargetDef[] = [
  { id: "male",   label: "男性",           category: "性別",     pricePerWeek: 1_500_000, impressionsPerWeek: 300_000 },
  { id: "female", label: "女性",           category: "性別",     pricePerWeek: 1_200_000, impressionsPerWeek: 240_000 },
  { id: "age20",  label: "20代（20-29歳）", category: "年代",     pricePerWeek: 750_000,   impressionsPerWeek: 150_000 },
  { id: "age30",  label: "30代（30-39歳）", category: "年代",     pricePerWeek: 675_000,   impressionsPerWeek: 135_000 },
  { id: "age40",  label: "40代（40-49歳）", category: "年代",     pricePerWeek: 600_000,   impressionsPerWeek: 120_000 },
  { id: "age50",  label: "50代以上",        category: "年代",     pricePerWeek: 600_000,   impressionsPerWeek: 120_000 },
  { id: "ride1",  label: "当該週1回目",     category: "乗車回数", pricePerWeek: 1_875_000, impressionsPerWeek: 375_000 },
  { id: "ride2",  label: "当該週2回目以降", category: "乗車回数", pricePerWeek: 2_100_000, impressionsPerWeek: 420_000 },
  { id: "m20",    label: "男性20代",        category: "性別×年代", pricePerWeek: 1_050_000, impressionsPerWeek: 105_000 },
  { id: "m30",    label: "男性30代",        category: "性別×年代", pricePerWeek: 1_050_000, impressionsPerWeek: 105_000 },
  { id: "m40",    label: "男性40代",        category: "性別×年代", pricePerWeek: 750_000,   impressionsPerWeek: 75_000  },
  { id: "m50",    label: "男性50代以上",    category: "性別×年代", pricePerWeek: 750_000,   impressionsPerWeek: 75_000  },
  { id: "f20",    label: "女性20代",        category: "性別×年代", pricePerWeek: 1_050_000, impressionsPerWeek: 105_000 },
  { id: "f30",    label: "女性30代",        category: "性別×年代", pricePerWeek: 750_000,   impressionsPerWeek: 75_000  },
  { id: "f40",    label: "女性40代",        category: "性別×年代", pricePerWeek: 600_000,   impressionsPerWeek: 60_000  },
  { id: "f50",    label: "女性50代以上",    category: "性別×年代", pricePerWeek: 600_000,   impressionsPerWeek: 60_000  },
];
