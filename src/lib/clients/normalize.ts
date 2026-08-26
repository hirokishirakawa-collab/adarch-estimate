// ==============================================================
// 取引先マップの共通ユーティリティ
//   - 社名の正規化（旧サイト実績と顧客管理の突合・Places の照合に使う）
//   - 住所 → 都道府県、都道府県 → 地方・地図の座標
//   - 業種の表記ゆれ → 傾向を見るための大きめの区分
//   - 従業員数 → 規模帯
// ==============================================================

/** 法人格・スペース・全角半角の差を消して社名を比べやすくする */
export function normalizeCompanyName(input: string): string {
  return (input ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\(株\)|\(有\)|\(同\)|㈱|㈲/g, "")
    .replace(
      /株式会社|有限会社|合同会社|合資会社|一般社団法人|公益社団法人|一般財団法人|公益財団法人|学校法人|医療法人(?:社団)?|社会福祉法人|特定非営利活動法人|npo法人|独立行政法人|国立研究開発法人|地方独立行政法人/g,
      "",
    )
    .replace(/co\.?,?\s*ltd\.?|corporation|corp\.?|inc\.?|k\.k\.?|limited|ltd\.?|llc/g, "")
    .replace(/[\s　・･\.,、。'’"“”\-–—_/／|｜&＆()（）【】\[\]「」]/g, "")
    .trim();
}

/** 2つの社名が同じ会社を指していると見なせるか（片方がもう片方を含む・4文字以上） */
export function isSameCompany(a: string, b: string): boolean {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  if (shorter.length < 3) return false;
  return longer.includes(shorter);
}

const PREF_RE = /(北海道|東京都|京都府|大阪府|[一-龥]{2,3}県)/;

/** 住所の文字列から都道府県だけ取り出す。無ければ null */
export function parsePrefecture(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = address.normalize("NFKC").match(PREF_RE);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------
// 地方区分（8地方）
// ---------------------------------------------------------------
export const REGIONS: { name: string; prefs: string[] }[] = [
  { name: "北海道・東北", prefs: ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { name: "関東", prefs: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { name: "北陸・甲信越", prefs: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県"] },
  { name: "東海", prefs: ["岐阜県", "静岡県", "愛知県", "三重県"] },
  { name: "近畿", prefs: ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { name: "中国", prefs: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { name: "四国", prefs: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { name: "九州・沖縄", prefs: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
  { name: "海外", prefs: ["海外"] },
];

export function regionOf(prefecture: string | null | undefined): string {
  if (!prefecture) return "不明";
  return REGIONS.find((r) => r.prefs.includes(prefecture))?.name ?? "不明";
}

/** 都道府県庁所在地のおおよその座標。Places で座標が取れない会社を地図に置くための代替 */
export const PREF_CENTROIDS: Record<string, [number, number]> = {
  北海道: [43.064, 141.347], 青森県: [40.824, 140.74], 岩手県: [39.704, 141.153], 宮城県: [38.269, 140.872],
  秋田県: [39.719, 140.102], 山形県: [38.24, 140.364], 福島県: [37.75, 140.468], 茨城県: [36.342, 140.447],
  栃木県: [36.566, 139.884], 群馬県: [36.391, 139.06], 埼玉県: [35.857, 139.649], 千葉県: [35.605, 140.123],
  東京都: [35.689, 139.692], 神奈川県: [35.448, 139.643], 新潟県: [37.902, 139.023], 富山県: [36.695, 137.211],
  石川県: [36.595, 136.626], 福井県: [36.065, 136.222], 山梨県: [35.664, 138.568], 長野県: [36.651, 138.181],
  岐阜県: [35.391, 136.722], 静岡県: [34.977, 138.383], 愛知県: [35.18, 136.907], 三重県: [34.73, 136.509],
  滋賀県: [35.005, 135.869], 京都府: [35.021, 135.756], 大阪府: [34.686, 135.52], 兵庫県: [34.691, 135.183],
  奈良県: [34.685, 135.833], 和歌山県: [34.226, 135.168], 鳥取県: [35.504, 134.238], 島根県: [35.472, 133.051],
  岡山県: [34.662, 133.935], 広島県: [34.396, 132.459], 山口県: [34.186, 131.471], 徳島県: [34.066, 134.559],
  香川県: [34.34, 134.043], 愛媛県: [33.842, 132.766], 高知県: [33.56, 133.531], 福岡県: [33.607, 130.418],
  佐賀県: [33.249, 130.3], 長崎県: [32.745, 129.874], 熊本県: [32.79, 130.742], 大分県: [33.238, 131.613],
  宮崎県: [31.911, 131.424], 鹿児島県: [31.56, 130.558], 沖縄県: [26.212, 127.681],
};

// ---------------------------------------------------------------
// 業種の大区分（顧客管理の industry は自由入力で表記ゆれが大きい）
// ---------------------------------------------------------------
const INDUSTRY_GROUPS: { name: string; match: RegExp }[] = [
  { name: "官公庁・団体", match: /官公庁|自治体|行政|公共|団体|協会|法人会|商工|組合|大使館|国連|省庁|市役所|県庁|町|村/ },
  { name: "製造業", match: /製造|メーカー|食品|飲料|化粧品|酒造|工業|機械|電機|素材|化学|薬品|製薬/ },
  { name: "建設・不動産", match: /建設|工事|設備|建築|リフォーム|工務|不動産|住宅|土木|設計/ },
  { name: "小売・EC", match: /小売|EC|通販|百貨店|販売|ディーラー|自動車販売|日産|トヨタ|ホンダ/ },
  { name: "飲食・宿泊・レジャー", match: /飲食|宿泊|ホテル|旅館|レジャー|観光|温泉|旅行|エンタメ|劇場|スポーツ/ },
  { name: "医療・福祉", match: /医療|福祉|病院|クリニック|介護|歯科|薬局/ },
  { name: "教育", match: /教育|学習|学校|大学|塾|保育|図書館/ },
  { name: "IT・情報通信", match: /IT|情報|通信|ソフト|システム|Web|アプリ|ゲーム|放送|テレビ|メディア|出版|広告/ },
  { name: "金融・保険", match: /金融|保険|銀行|証券|信用/ },
  { name: "運輸・物流", match: /運輸|物流|郵便|鉄道|航空|タクシー|バス|倉庫/ },
  { name: "士業・コンサル", match: /士|コンサル|専門サービス|会計|税務|法律|人材|派遣|紹介/ },
  { name: "サービス業", match: /サービス|美容|理容|冠婚|葬祭|清掃|警備|レンタル/ },
  { name: "農林水産", match: /農|林|漁|水産|畜産/ },
];

export function industryGroup(industry: string | null | undefined): string {
  const s = (industry ?? "").trim();
  if (!s) return "未設定";
  for (const g of INDUSTRY_GROUPS) if (g.match.test(s)) return g.name;
  return "その他";
}

// ---------------------------------------------------------------
// 規模帯（従業員数）
// ---------------------------------------------------------------
export const SIZE_BANDS = ["〜10名", "11〜50名", "51〜300名", "301〜1,000名", "1,001名〜"] as const;
export type SizeBand = (typeof SIZE_BANDS)[number] | "不明";

export function sizeBand(employeeCount: number | null | undefined): SizeBand {
  if (employeeCount == null || employeeCount <= 0) return "不明";
  if (employeeCount <= 10) return "〜10名";
  if (employeeCount <= 50) return "11〜50名";
  if (employeeCount <= 300) return "51〜300名";
  if (employeeCount <= 1000) return "301〜1,000名";
  return "1,001名〜";
}

export const RATING_BANDS = ["4.5以上", "4.0〜4.4", "3.5〜3.9", "3.5未満"] as const;
export type RatingBand = (typeof RATING_BANDS)[number] | "口コミなし";

export function ratingBand(rating: number | null | undefined, count: number | null | undefined): RatingBand {
  if (rating == null || !count) return "口コミなし";
  if (rating >= 4.5) return "4.5以上";
  if (rating >= 4.0) return "4.0〜4.4";
  if (rating >= 3.5) return "3.5〜3.9";
  return "3.5未満";
}

/** 資本金を「1億2,000万円」のように短く出す */
export function formatCapital(yen: bigint | number | null | undefined): string | null {
  if (yen == null) return null;
  const n = Number(yen);
  if (!Number.isFinite(n) || n <= 0) return null;
  const oku = Math.floor(n / 1e8);
  const man = Math.round((n - oku * 1e8) / 1e4);
  const parts: string[] = [];
  if (oku > 0) parts.push(`${oku.toLocaleString("ja-JP")}億`);
  if (man > 0) parts.push(`${man.toLocaleString("ja-JP")}万`);
  if (parts.length === 0) return `${n.toLocaleString("ja-JP")}円`;
  return `${parts.join("")}円`;
}
