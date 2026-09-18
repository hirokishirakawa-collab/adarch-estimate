// ==============================================================
// Meta広告の想定費用で選べるターゲット（サーバー/クライアント共用・純粋データ）
//   2026-09-18 代表決定: TVer・広告媒体の販売先＝「広告を決める人」と「TVerの主な広告主の業種で働く人」
//   IDはMeta全体で共通（本部の接続で meta_targeting_search して確認したもの）。同じ配列の中はどれか1つに当てはまる人（OR）
// ==============================================================

export type AudienceItem = { field: string; id: string; name: string };
export type AudiencePreset = { key: string; label: string; group: string; audience: AudienceItem[] };

const i = (id: string, name: string): AudienceItem => ({ field: "interests", id, name });
const ind = (id: string, name: string): AudienceItem => ({ field: "industries", id, name });

export const AUDIENCE_PRESETS: AudiencePreset[] = [
  { key: "none", label: "指定なし（年齢だけ）", group: "", audience: [] },
  {
    key: "owners", label: "経営者・代表者", group: "広告を決める人",
    audience: [
      { field: "behaviors", id: "6002714898572", name: "中小企業のオーナー" },
      { field: "behaviors", id: "6020530281783", name: "ビジネスページの管理者" },
      { field: "work_positions", id: "136911256338025", name: "代表者" },
      { field: "work_positions", id: "213365325344846", name: "代表取締役" },
      { field: "work_positions", id: "412472872275336", name: "代表者(個人事業主)" },
      { field: "work_positions", id: "454122974645077", name: "オーナー経営者" },
    ],
  },
  {
    key: "marketing", label: "マーケティング・広告に関心", group: "広告を決める人",
    audience: [
      i("6003279598823", "マーケティング"), i("6003584163107", "広告"), i("6003526234370", "オンライン広告"),
      i("6003127206524", "デジタルマーケティング"), i("6003389760112", "ソーシャルメディアマーケティング"), i("6003702887891", "広告会社"),
    ],
  },
  {
    key: "managers", label: "管理職・意思決定者", group: "広告を決める人",
    audience: [ind("6008888954983", "管理"), ind("6009003311983", "マネジメント"), ind("6262428231783", "ビジネスの意思決定者")],
  },
  {
    key: "small_company", label: "小さな会社の人（社員100人以下）", group: "広告を決める人",
    audience: [ind("6377169550583", "会社規模: 社員数1〜10人"), ind("6377134779583", "会社規模: 社員数11〜100人")],
  },
  {
    key: "startup", label: "起業・中小企業に関心", group: "広告を決める人",
    audience: [i("6003371567474", "起業"), i("6003136069408", "中小企業")],
  },
  {
    key: "construction", label: "建設・住宅の仕事", group: "業種で働く人",
    audience: [ind("6012903128783", "建設"), ind("6012903126783", "建築・工学"), ind("6012903160983", "設備・修理")],
  },
  {
    key: "medical", label: "医療・介護の仕事", group: "業種で働く人",
    audience: [ind("6012903159383", "ヘルスケア・医療"), ind("6012903168383", "地域福祉・社会福祉"), { field: "work_positions", id: "103092223080951", name: "院長" }],
  },
  { key: "food", label: "飲食の仕事", group: "業種で働く人", audience: [ind("6012903127583", "食品・レストラン")] },
  { key: "manufacturing", label: "製造・営業の仕事", group: "業種で働く人", audience: [ind("6012903140583", "製造"), ind("6008888980183", "営業")] },
];

export const presetByKey = (key: string) => AUDIENCE_PRESETS.find((p) => p.key === key) ?? AUDIENCE_PRESETS[0];
