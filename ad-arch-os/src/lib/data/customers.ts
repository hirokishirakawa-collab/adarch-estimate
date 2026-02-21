// ==============================================================
// CRM ダミーデータ & 権限ロジック（Phase 1）
// Phase 2: Prisma + DB に差し替える
// CSVインポートによる自動生成（76件・14拠点）
// ==============================================================

import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 拠点マスタ（メールアドレスから自動生成）
// ---------------------------------------------------------------
export const BRANCH_MAP = {
  branch_hq: { id: "branch_hq", name: "本部", code: "HQ", badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  branch_isk: { id: "branch_isk", name: "石川", code: "ISK", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  branch_kgo: { id: "branch_kgo", name: "香川・岡山", code: "KGO", badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  branch_kyt: { id: "branch_kyt", name: "京都", code: "KYT", badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
  branch_tky: { id: "branch_tky", name: "東京（片桐）", code: "TKY", badgeClass: "bg-violet-100 text-violet-700 border-violet-200" },
  branch_ymc: { id: "branch_ymc", name: "山口・広島", code: "YMC", badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  branch_hkd: { id: "branch_hkd", name: "北海道", code: "HKD", badgeClass: "bg-lime-100 text-lime-700 border-lime-200" },
  branch_tk2: { id: "branch_tk2", name: "東京（白石）", code: "TK2", badgeClass: "bg-sky-100 text-sky-700 border-sky-200" },
  branch_kns: { id: "branch_kns", name: "関西（宮本）", code: "KNS", badgeClass: "bg-purple-100 text-purple-700 border-purple-200" },
  branch_okn: { id: "branch_okn", name: "沖縄", code: "OKN", badgeClass: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  branch_tks: { id: "branch_tks", name: "徳島", code: "TKS", badgeClass: "bg-green-100 text-green-700 border-green-200" },
  branch_ibk: { id: "branch_ibk", name: "茨城", code: "IBK", badgeClass: "bg-teal-100 text-teal-700 border-teal-200" },
  branch_fku: { id: "branch_fku", name: "福岡", code: "FKU", badgeClass: "bg-pink-100 text-pink-700 border-pink-200" },
  branch_knw: { id: "branch_knw", name: "神奈川", code: "KNW", badgeClass: "bg-rose-100 text-rose-700 border-rose-200" },
} as const;

export type BranchId = keyof typeof BRANCH_MAP;
export type BranchInfo = (typeof BRANCH_MAP)[BranchId];

// メール → 拠点IDマッピング
const EMAIL_TO_BRANCH: Record<string, string> = {
  "hiroki.shirakawa@adarch.co.jp": "branch_hq",
  "ishikawa@adarch.co.jp": "branch_isk",
  "kagawa_okayama@adarch.co.jp": "branch_kgo",
  "mtakahashi@adarch.co.jp": "branch_kyt",
  "katagiri@adarch.co.jp": "branch_tky",
  "yamaguchi@adarch.co.jp": "branch_ymc",
  "s.keita@adarch.co.jp": "branch_hkd",
  "toru.shiraishi@adarch.co.jp": "branch_tk2",
  "takashi.miyamoto@adarch.co.jp": "branch_kns",
  "okinawa@adarch.co.jp": "branch_okn",
  "tokushima@adarch.co.jp": "branch_tks",
  "ibaraki@adarch.co.jp": "branch_ibk",
  "hamaguchi@adarch.co.jp": "branch_fku",
  "fujiwara@adarch.co.jp": "branch_knw",
};

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------
export type DealStatus =
  | "PROSPECTING"
  | "QUALIFYING"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export interface DummyDeal {
  id: string;
  title: string;
  amount: number | null;
  status: DealStatus;
  branchId: string;
  expectedCloseDate: string | null;
}

export interface DummyCustomer {
  id: string;
  name: string;
  nameKana: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  branchId: string;
  branch: BranchInfo;
  lockedByName: string | null;
  lockExpiresAt: Date | null;
  deals: DummyDeal[];
  createdAt: Date;
}

const now = new Date();
// 正の値: 過去。負の値: 未来（例: daysAgo(-3) = 3日後 = ロック期限に使用）
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400 * 1000);

// ---------------------------------------------------------------
// 顧客データ（CSVインポート・76件）
// ---------------------------------------------------------------
export const DUMMY_CUSTOMERS: DummyCustomer[] = [
  // record 82
  {
    id: "cust_82",
    name: "オステリア ロンド",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "086-237-3627",
    address: "香川県岡山県岡山市北区柳町1-7-9矢吹ビル１F",
    industry: "飲食・宿泊・レジャー",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: "白川 裕喜",
    lockExpiresAt: daysAgo(-3),
    deals: [
      {
        id: "deal_82_1",
        title: "集客・SNS運用支援提案",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kgo",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(75),
  },
  // record 81
  {
    id: "cust_81",
    name: "京都日産自動車株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "京都府",
    industry: "商社・卸売",
    branchId: "branch_kyt",
    branch: BRANCH_MAP.branch_kyt,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_81_1",
        title: "業界向けブランディング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kyt",
        expectedCloseDate: "2026-04-15",
      },
    ],
    createdAt: daysAgo(193),
  },
  // record 80
  {
    id: "cust_80",
    name: "NECグリーンロケッツ東葛",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "千葉県",
    industry: "エンタメ・レジャー",
    branchId: "branch_tky",
    branch: BRANCH_MAP.branch_tky,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_80_1",
        title: "イベント集客デジタル広告",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_tky",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(113),
  },
  // record 79
  {
    id: "cust_79",
    name: "石川県警察本部 生活安全部 生活安全企画課",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "官公庁・自治体",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_79_1",
        title: "広報・情報発信デジタル支援",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_isk",
        expectedCloseDate: "2026-03-15",
      },
    ],
    createdAt: daysAgo(60),
  },
  // record 78
  {
    id: "cust_78",
    name: "株式会社ロピア",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "神奈川県",
    industry: "小売・EC",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_78_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_ymc",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(55),
  },
  // record 77
  {
    id: "cust_77",
    name: "朝日エイテック株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "建設・設備・工事業",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_77_1",
        title: "採用・ブランディング施策",
        amount: null,
        status: "NEGOTIATION",
        branchId: "branch_isk",
        expectedCloseDate: "2026-06-28",
      },
    ],
    createdAt: daysAgo(76),
  },
  // record 76
  {
    id: "cust_76",
    name: "株式会社金沢すっぽん堂本舗",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "小売・EC",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_76_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_isk",
        expectedCloseDate: "2026-04-28",
      },
    ],
    createdAt: daysAgo(113),
  },
  // record 75
  {
    id: "cust_75",
    name: "北陸綜合警備保障株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "その他",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_75_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_isk",
        expectedCloseDate: "2026-05-15",
      },
    ],
    createdAt: daysAgo(60),
  },
  // record 74
  {
    id: "cust_74",
    name: "株式会社田中組",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: null,
    industry: "建設・設備・工事業",
    branchId: "branch_hkd",
    branch: BRANCH_MAP.branch_hkd,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_74_1",
        title: "株式会社田中組 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_hkd",
        expectedCloseDate: "2025-10-03",
      },
    ],
    createdAt: daysAgo(102),
  },
  // record 73
  {
    id: "cust_73",
    name: "とんでん",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "北海道",
    industry: "飲食・宿泊・レジャー",
    branchId: "branch_hkd",
    branch: BRANCH_MAP.branch_hkd,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_73_1",
        title: "集客・SNS運用支援提案",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_hkd",
        expectedCloseDate: "2026-05-20",
      },
    ],
    createdAt: daysAgo(159),
  },
  // record 72
  {
    id: "cust_72",
    name: "アスクゲートイースト",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "北海道",
    industry: "人材・アウトソーシング",
    branchId: "branch_hkd",
    branch: BRANCH_MAP.branch_hkd,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_72_1",
        title: "採用広告・求人支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_hkd",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(122),
  },
  // record 71
  {
    id: "cust_71",
    name: "エフ・プロジェクト株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都",
    industry: "その他",
    branchId: "branch_tk2",
    branch: BRANCH_MAP.branch_tk2,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_71_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_tk2",
        expectedCloseDate: "2026-03-20",
      },
    ],
    createdAt: daysAgo(25),
  },
  // record 70
  {
    id: "cust_70",
    name: "株式会社ザ・ファースト",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都",
    industry: "その他",
    branchId: "branch_tk2",
    branch: BRANCH_MAP.branch_tk2,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_70_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_tk2",
        expectedCloseDate: "2026-05-28",
      },
    ],
    createdAt: daysAgo(163),
  },
  // record 69
  {
    id: "cust_69",
    name: "ROHAKU建築設計",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "京都府",
    industry: "不動産・住宅",
    branchId: "branch_kyt",
    branch: BRANCH_MAP.branch_kyt,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_69_1",
        title: "物件集客デジタル広告",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kyt",
        expectedCloseDate: "2026-04-28",
      },
    ],
    createdAt: daysAgo(22),
  },
  // record 68
  {
    id: "cust_68",
    name: "株式会社アイ・オー・データ機器",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "製造（機械・電気・電子）",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_68_1",
        title: "BtoB販促コンテンツ制作",
        amount: null,
        status: "PROPOSAL",
        branchId: "branch_isk",
        expectedCloseDate: "2026-05-15",
      },
    ],
    createdAt: daysAgo(64),
  },
  // record 67
  {
    id: "cust_67",
    name: "石川日産自動車販売株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "小売・EC",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_67_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROPOSAL",
        branchId: "branch_isk",
        expectedCloseDate: "2026-05-20",
      },
    ],
    createdAt: daysAgo(167),
  },
  // record 66
  {
    id: "cust_66",
    name: "株式会社アクシス 岡山支社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "0868050070",
    address: "岡山県岡山県岡山市北区下中野３６５番地１０３",
    industry: "広告・出版・マスコミ",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_66_1",
        title: "株式会社アクシス 岡山支社 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_kgo",
        expectedCloseDate: "2025-11-12",
      },
    ],
    createdAt: daysAgo(95),
  },
  // record 65
  {
    id: "cust_65",
    name: "北陸スバル自動車株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "小売・EC",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_65_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_isk",
        expectedCloseDate: "2026-05-28",
      },
    ],
    createdAt: daysAgo(179),
  },
  // record 64
  {
    id: "cust_64",
    name: "株式会社エッジ・インターナショナル",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "03-3403-7750",
    address: "東京都東京都港区赤坂7-1-1青山安田ビル",
    industry: "コンサルティング・専門サービス",
    branchId: "branch_kns",
    branch: BRANCH_MAP.branch_kns,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_64_1",
        title: "コンテンツマーケティング支援",
        amount: null,
        status: "PROPOSAL",
        branchId: "branch_kns",
        expectedCloseDate: "2026-04-28",
      },
    ],
    createdAt: daysAgo(191),
  },
  // record 63
  {
    id: "cust_63",
    name: "社団法人石川県物産協会",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "団体・NPO・組合",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_63_1",
        title: "社団法人石川県物産協会 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_isk",
        expectedCloseDate: "2025-11-15",
      },
    ],
    createdAt: daysAgo(102),
  },
  // record 62
  {
    id: "cust_62",
    name: "株式会社アデランス",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都",
    industry: "小売・EC",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_62_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_ymc",
        expectedCloseDate: "2026-04-28",
      },
    ],
    createdAt: daysAgo(88),
  },
  // record 61
  {
    id: "cust_61",
    name: "三谷産業株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "建設・設備・工事業",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_61_1",
        title: "採用・ブランディング施策",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_isk",
        expectedCloseDate: "2026-04-15",
      },
    ],
    createdAt: daysAgo(85),
  },
  // record 60
  {
    id: "cust_60",
    name: "石川県漁業協同組合",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "団体・NPO・組合",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_60_1",
        title: "認知度向上・会員獲得支援",
        amount: null,
        status: "NEGOTIATION",
        branchId: "branch_isk",
        expectedCloseDate: "2026-03-15",
      },
    ],
    createdAt: daysAgo(150),
  },
  // record 59
  {
    id: "cust_59",
    name: "金沢都市政策局　地域力再生化",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "官公庁・自治体",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_59_1",
        title: "広報・情報発信デジタル支援",
        amount: null,
        status: "NEGOTIATION",
        branchId: "branch_isk",
        expectedCloseDate: "2026-06-20",
      },
    ],
    createdAt: daysAgo(169),
  },
  // record 58
  {
    id: "cust_58",
    name: "社会福祉法人りじょう福祉会",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "082-879-0479",
    address: "広島県広島市安佐南区大町東３丁目１２?３０",
    industry: "教育・学校・学習支援",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_58_1",
        title: "社会福祉法人りじょう福祉会 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ymc",
        expectedCloseDate: "2025-11-09",
      },
    ],
    createdAt: daysAgo(40),
  },
  // record 57
  {
    id: "cust_57",
    name: "学校法人鯉城学園",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "082-879-0479",
    address: "広島県広島市安佐南区大町東３丁目１２?３０",
    industry: "教育・学校・学習支援",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_57_1",
        title: "学校法人鯉城学園 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ymc",
        expectedCloseDate: "2026-02-18",
      },
    ],
    createdAt: daysAgo(72),
  },
  // record 56
  {
    id: "cust_56",
    name: "一般財団法人やない花のまちづくり振興財団",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "0820-24-1187",
    address: "山口県山口県柳井市新庄500-1",
    industry: "エンタメ・レジャー",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_56_1",
        title: "イベント集客デジタル広告",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_ymc",
        expectedCloseDate: "2026-06-28",
      },
    ],
    createdAt: daysAgo(107),
  },
  // record 55
  {
    id: "cust_55",
    name: "農林水産省 北陸農政局",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県石川県金沢市広坂２丁目２－６０",
    industry: "官公庁・自治体",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_55_1",
        title: "農林水産省 北陸農政局 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_isk",
        expectedCloseDate: "2025-11-05",
      },
    ],
    createdAt: daysAgo(135),
  },
  // record 54
  {
    id: "cust_54",
    name: "株式会社Various",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都",
    industry: "コンサルティング・専門サービス",
    branchId: "branch_tky",
    branch: BRANCH_MAP.branch_tky,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_54_1",
        title: "株式会社Various 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_tky",
        expectedCloseDate: "2025-10-25",
      },
    ],
    createdAt: daysAgo(17),
  },
  // record 53
  {
    id: "cust_53",
    name: "税理士法人原田税務会計事務所",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "03-3583-7737",
    address: "東京都",
    industry: "コンサルティング・専門サービス",
    branchId: "branch_tky",
    branch: BRANCH_MAP.branch_tky,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_53_1",
        title: "税理士法人原田税務会計事務所 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_tky",
        expectedCloseDate: "2025-11-21",
      },
    ],
    createdAt: daysAgo(45),
  },
  // record 52
  {
    id: "cust_52",
    name: "株式会社福岡商会",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "製造（食品・飲料・化粧品）",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_52_1",
        title: "食品ブランド販促支援",
        amount: null,
        status: "NEGOTIATION",
        branchId: "branch_isk",
        expectedCloseDate: "2026-03-20",
      },
    ],
    createdAt: daysAgo(102),
  },
  // record 51
  {
    id: "cust_51",
    name: "西山産業開発株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "建設・設備・工事業",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_51_1",
        title: "採用・ブランディング施策",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_isk",
        expectedCloseDate: "2026-06-28",
      },
    ],
    createdAt: daysAgo(69),
  },
  // record 50
  {
    id: "cust_50",
    name: "会宝産業株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "商社・卸売",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_50_1",
        title: "業界向けブランディング支援",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_isk",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(189),
  },
  // record 49
  {
    id: "cust_49",
    name: "一般社団法人石川県物産協会",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "その他",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_49_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "PROPOSAL",
        branchId: "branch_isk",
        expectedCloseDate: "2026-05-28",
      },
    ],
    createdAt: daysAgo(92),
  },
  // record 48
  {
    id: "cust_48",
    name: "株式会社アンガット",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "0989417200",
    address: "沖縄県沖縄県那覇市おもろまち2丁目6-11フロンティアビル (南3F)",
    industry: "小売・EC",
    branchId: "branch_okn",
    branch: BRANCH_MAP.branch_okn,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_48_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_okn",
        expectedCloseDate: "2026-05-20",
      },
    ],
    createdAt: daysAgo(45),
  },
  // record 47
  {
    id: "cust_47",
    name: "六花亭",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "北海道",
    industry: "製造（食品・飲料・化粧品）",
    branchId: "branch_hkd",
    branch: BRANCH_MAP.branch_hkd,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_47_1",
        title: "六花亭 過去案件",
        amount: null,
        status: "CLOSED_LOST",
        branchId: "branch_hkd",
        expectedCloseDate: "2026-01-01",
      },
    ],
    createdAt: daysAgo(189),
  },
  // record 46
  {
    id: "cust_46",
    name: "徳島ヴォルティス株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "088-672-7252",
    address: "徳島県徳島県板野郡板野町犬伏字瓢谷2-22",
    industry: "その他",
    branchId: "branch_tks",
    branch: BRANCH_MAP.branch_tks,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_46_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "QUALIFYING",
        branchId: "branch_tks",
        expectedCloseDate: "2026-05-28",
      },
    ],
    createdAt: daysAgo(200),
  },
  // record 44
  {
    id: "cust_44",
    name: "四国計測工業株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "0877-33-2221",
    address: "香川県香川県仲多度郡多度津町南鴨200番地1",
    industry: "製造（機械・電気・電子）",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_44_1",
        title: "BtoB販促コンテンツ制作",
        amount: null,
        status: "PROPOSAL",
        branchId: "branch_kgo",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(81),
  },
  // record 43
  {
    id: "cust_43",
    name: "株式会社アーバンレック",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "087-822-0210",
    address: "香川県香川県高松市磨屋町6番地6",
    industry: "不動産・住宅",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_43_1",
        title: "株式会社アーバンレック 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_kgo",
        expectedCloseDate: "2026-02-07",
      },
    ],
    createdAt: daysAgo(44),
  },
  // record 42
  {
    id: "cust_42",
    name: "株式会社道とん堀",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "042-551-5041",
    address: "東京都東京都福生市加美平一丁目6番地17",
    industry: "飲食・宿泊・レジャー",
    branchId: "branch_hq",
    branch: BRANCH_MAP.branch_hq,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_42_1",
        title: "集客・SNS運用支援提案",
        amount: null,
        status: "NEGOTIATION",
        branchId: "branch_hq",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(87),
  },
  // record 41
  {
    id: "cust_41",
    name: "有限会社筑波ハム",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "029-879-9101",
    address: "茨城県茨城県つくば市下平塚３５６番地の１",
    industry: "製造（食品・飲料・化粧品）",
    branchId: "branch_ibk",
    branch: BRANCH_MAP.branch_ibk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_41_1",
        title: "有限会社筑波ハム 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ibk",
        expectedCloseDate: "2025-10-04",
      },
    ],
    createdAt: daysAgo(97),
  },
  // record 40
  {
    id: "cust_40",
    name: "NPO法人ＴＯＰ　ＦＩＧＨＴＥＲ　ＪＡＰＡＮ",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "茨城県茨城県稲敷郡阿見町大字青宿字古山台６７６番１４",
    industry: "団体・NPO・組合",
    branchId: "branch_ibk",
    branch: BRANCH_MAP.branch_ibk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_40_1",
        title: "NPO法人ＴＯＰ　ＦＩＧＨＴＥＲ　ＪＡＰＡＮ 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ibk",
        expectedCloseDate: "2025-11-02",
      },
    ],
    createdAt: daysAgo(66),
  },
  // record 39
  {
    id: "cust_39",
    name: "Beauty Japan 茨城大会運営事務局",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "茨城県茨城県守谷市中2-17-1",
    industry: "団体・NPO・組合",
    branchId: "branch_ibk",
    branch: BRANCH_MAP.branch_ibk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_39_1",
        title: "Beauty Japan 茨城大会運営事務局 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ibk",
        expectedCloseDate: "2025-10-03",
      },
    ],
    createdAt: daysAgo(192),
  },
  // record 38
  {
    id: "cust_38",
    name: "有限会社猪瀬電気",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "0297-68-9429",
    address: "茨城県茨城県北相馬郡利根町もえぎ野台1-1-1",
    industry: "建設・設備・工事業",
    branchId: "branch_ibk",
    branch: BRANCH_MAP.branch_ibk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_38_1",
        title: "有限会社猪瀬電気 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ibk",
        expectedCloseDate: "2025-10-25",
      },
    ],
    createdAt: daysAgo(141),
  },
  // record 37
  {
    id: "cust_37",
    name: "ANDSUNS株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "茨城県茨城県下妻市平方１９４",
    industry: "建設・設備・工事業",
    branchId: "branch_ibk",
    branch: BRANCH_MAP.branch_ibk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_37_1",
        title: "ANDSUNS株式会社 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ibk",
        expectedCloseDate: "2025-11-22",
      },
    ],
    createdAt: daysAgo(126),
  },
  // record 36
  {
    id: "cust_36",
    name: "株式会社UNICO",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "0297-44-6123",
    address: "茨城県茨城県守谷市緑2-25-10",
    industry: "製造（機械・電気・電子）",
    branchId: "branch_ibk",
    branch: BRANCH_MAP.branch_ibk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_36_1",
        title: "株式会社UNICO 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ibk",
        expectedCloseDate: "2025-11-09",
      },
    ],
    createdAt: daysAgo(140),
  },
  // record 35
  {
    id: "cust_35",
    name: "株式会社さとう",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "京都府",
    industry: "小売・EC",
    branchId: "branch_kyt",
    branch: BRANCH_MAP.branch_kyt,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_35_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kyt",
        expectedCloseDate: "2026-06-15",
      },
    ],
    createdAt: daysAgo(143),
  },
  // record 34
  {
    id: "cust_34",
    name: "タニコー株式会社 高松営業所",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "087-813-3170",
    address: "香川県香川県高松市常磐町1-3-1瓦町フラッグ地下１F",
    industry: "製造（機械・電気・電子）",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_34_1",
        title: "BtoB販促コンテンツ制作",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kgo",
        expectedCloseDate: "2026-05-20",
      },
    ],
    createdAt: daysAgo(176),
  },
  // record 33
  {
    id: "cust_33",
    name: "JR西日本京都SC開発株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "075-365-7514",
    address: "京都府京都府京都市下京区東塩小路町579-27木津屋橋ビル",
    industry: "その他",
    branchId: "branch_kns",
    branch: BRANCH_MAP.branch_kns,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_33_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kns",
        expectedCloseDate: "2026-06-28",
      },
    ],
    createdAt: daysAgo(120),
  },
  // record 32
  {
    id: "cust_32",
    name: "アクアクララ京都株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "075-631-7860",
    address: "京都府京都府久世郡久御山町野村村東182",
    industry: "小売・EC",
    branchId: "branch_kns",
    branch: BRANCH_MAP.branch_kns,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_32_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kns",
        expectedCloseDate: "2026-04-15",
      },
    ],
    createdAt: daysAgo(21),
  },
  // record 31
  {
    id: "cust_31",
    name: "株式会社岡山乗馬倶楽部",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "0867-34-9911",
    address: "岡山県岡山県加賀郡吉備中央町上田西2393-11",
    industry: "エンタメ・レジャー",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_31_1",
        title: "イベント集客デジタル広告",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kgo",
        expectedCloseDate: "2026-03-28",
      },
    ],
    createdAt: daysAgo(146),
  },
  // record 30
  {
    id: "cust_30",
    name: "西日本放送株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "087-826-7333",
    address: "香川県香川県高松市丸の内8番15号",
    industry: "広告・出版・マスコミ",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: "片桐 健一",
    lockExpiresAt: daysAgo(-3),
    deals: [
      {
        id: "deal_30_1",
        title: "西日本放送株式会社 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_kgo",
        expectedCloseDate: "2026-02-08",
      },
    ],
    createdAt: daysAgo(6),
  },
  // record 29
  {
    id: "cust_29",
    name: "アマゾンジャパン",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都",
    industry: "小売・EC",
    branchId: "branch_hq",
    branch: BRANCH_MAP.branch_hq,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_29_1",
        title: "アマゾンジャパン 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_hq",
        expectedCloseDate: "2025-10-08",
      },
    ],
    createdAt: daysAgo(22),
  },
  // record 28
  {
    id: "cust_28",
    name: "株式会社SaraBe",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "徳島県徳島県徳島市国府町和田字表２０番地７",
    industry: "その他",
    branchId: "branch_tks",
    branch: BRANCH_MAP.branch_tks,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_28_1",
        title: "株式会社SaraBe 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_tks",
        expectedCloseDate: "2025-12-03",
      },
    ],
    createdAt: daysAgo(136),
  },
  // record 27
  {
    id: "cust_27",
    name: "ECC_犬伏由美",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "https://ecc-aizumi.com/lp/2026-early-start/",
    address: "徳島県",
    industry: "教育・学校・学習支援",
    branchId: "branch_tks",
    branch: BRANCH_MAP.branch_tks,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_27_1",
        title: "ECC_犬伏由美 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_tks",
        expectedCloseDate: "2025-12-22",
      },
    ],
    createdAt: daysAgo(129),
  },
  // record 26
  {
    id: "cust_26",
    name: "株式会社テレビ東京",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都東京都港区六本木3-2-1 六本木グランドタワー",
    industry: "広告・出版・マスコミ",
    branchId: "branch_hq",
    branch: BRANCH_MAP.branch_hq,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_26_1",
        title: "株式会社テレビ東京 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_hq",
        expectedCloseDate: "2026-02-05",
      },
    ],
    createdAt: daysAgo(190),
  },
  // record 25
  {
    id: "cust_25",
    name: "スポーツコミュニケーションKYOTO株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "京都府",
    industry: "その他",
    branchId: "branch_kyt",
    branch: BRANCH_MAP.branch_kyt,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_25_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kyt",
        expectedCloseDate: "2026-06-15",
      },
    ],
    createdAt: daysAgo(126),
  },
  // record 24
  {
    id: "cust_24",
    name: "イオンエンターテイメント株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都",
    industry: "エンタメ・レジャー",
    branchId: "branch_hq",
    branch: BRANCH_MAP.branch_hq,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_24_1",
        title: "イオンエンターテイメント株式会社 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_hq",
        expectedCloseDate: "2025-11-04",
      },
    ],
    createdAt: daysAgo(29),
  },
  // record 21
  {
    id: "cust_21",
    name: "安藤工事株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "092-561-7012",
    address: "福岡県福岡県福岡市南区清水2丁目9番6号",
    industry: "建設・設備・工事業",
    branchId: "branch_fku",
    branch: BRANCH_MAP.branch_fku,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_21_1",
        title: "採用・ブランディング施策",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_fku",
        expectedCloseDate: "2026-05-20",
      },
    ],
    createdAt: daysAgo(110),
  },
  // record 20
  {
    id: "cust_20",
    name: "株式会社すかいらーくホールディングス",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "東京都",
    industry: "飲食・宿泊・レジャー",
    branchId: "branch_hq",
    branch: BRANCH_MAP.branch_hq,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_20_1",
        title: "株式会社すかいらーくホールディングス 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_hq",
        expectedCloseDate: "2025-10-22",
      },
    ],
    createdAt: daysAgo(172),
  },
  // record 19
  {
    id: "cust_19",
    name: "株式会社京都パープルサンガ",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "京都府",
    industry: "その他",
    branchId: "branch_kyt",
    branch: BRANCH_MAP.branch_kyt,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_19_1",
        title: "マーケティング総合支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_kyt",
        expectedCloseDate: "2026-03-20",
      },
    ],
    createdAt: daysAgo(191),
  },
  // record 18
  {
    id: "cust_18",
    name: "三井アウトレットパーク横浜ベイサイド",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "神奈川県",
    industry: "小売・EC",
    branchId: "branch_knw",
    branch: BRANCH_MAP.branch_knw,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_18_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_knw",
        expectedCloseDate: "2026-03-15",
      },
    ],
    createdAt: daysAgo(54),
  },
  // record 17
  {
    id: "cust_17",
    name: "ラゾーナ川崎プラザ",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "神奈川県",
    industry: "小売・EC",
    branchId: "branch_knw",
    branch: BRANCH_MAP.branch_knw,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_17_1",
        title: "ECデジタルマーケティング支援",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_knw",
        expectedCloseDate: "2026-06-15",
      },
    ],
    createdAt: daysAgo(113),
  },
  // record 16
  {
    id: "cust_16",
    name: "株式会社BigNext",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "09024305422",
    address: "神奈川県神奈川県横浜市港北区鳥山町1266-1",
    industry: "商社・卸売",
    branchId: "branch_knw",
    branch: BRANCH_MAP.branch_knw,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_16_1",
        title: "株式会社BigNext 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_knw",
        expectedCloseDate: "2025-12-15",
      },
    ],
    createdAt: daysAgo(68),
  },
  // record 15
  {
    id: "cust_15",
    name: "横浜ビーコルセアーズ",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "神奈川県",
    industry: "エンタメ・レジャー",
    branchId: "branch_knw",
    branch: BRANCH_MAP.branch_knw,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_15_1",
        title: "イベント集客デジタル広告",
        amount: null,
        status: "PROSPECTING",
        branchId: "branch_knw",
        expectedCloseDate: "2026-06-28",
      },
    ],
    createdAt: daysAgo(30),
  },
  // record 14
  {
    id: "cust_14",
    name: "学校法人三幸学園 沖縄みらいAI&IT専門学校",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "050-5805-3567",
    address: "沖縄県沖縄県那覇市泊2?6?8",
    industry: "教育・学校・学習支援",
    branchId: "branch_okn",
    branch: BRANCH_MAP.branch_okn,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_14_1",
        title: "学校法人三幸学園 沖縄みらいAI&IT専門学校 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_okn",
        expectedCloseDate: "2026-02-27",
      },
    ],
    createdAt: daysAgo(8),
  },
  // record 13
  {
    id: "cust_13",
    name: "銭形ロックフェス実行委員会",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "香川県香川県観音寺市",
    industry: "エンタメ・レジャー",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_13_1",
        title: "イベント集客デジタル広告",
        amount: null,
        status: "PROPOSAL",
        branchId: "branch_kgo",
        expectedCloseDate: "2026-04-20",
      },
    ],
    createdAt: daysAgo(129),
  },
  // record 12
  {
    id: "cust_12",
    name: "香川日産自動車株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "087-831-1451",
    address: "香川県高松市花園町1丁目1番8号",
    industry: "小売・EC",
    branchId: "branch_kgo",
    branch: BRANCH_MAP.branch_kgo,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_12_1",
        title: "香川日産自動車株式会社 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_kgo",
        expectedCloseDate: "2025-11-28",
      },
    ],
    createdAt: daysAgo(107),
  },
  // record 11
  {
    id: "cust_11",
    name: "株式会社Plan・Do・See",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "京都府",
    industry: "飲食・宿泊・レジャー",
    branchId: "branch_kyt",
    branch: BRANCH_MAP.branch_kyt,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_11_1",
        title: "株式会社Plan・Do・See 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_kyt",
        expectedCloseDate: "2025-11-13",
      },
    ],
    createdAt: daysAgo(5),
  },
  // record 10
  {
    id: "cust_10",
    name: "株式会社ウッドワン",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "広島県広島県廿日市市木材港南1-1",
    industry: "製造（その他）",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_10_1",
        title: "株式会社ウッドワン 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ymc",
        expectedCloseDate: "2025-12-26",
      },
    ],
    createdAt: daysAgo(121),
  },
  // record 9
  {
    id: "cust_9",
    name: "青藍会グループ",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "083-933-6000",
    address: "山口県山口市吉敷中東1丁目1-1",
    industry: "医療・介護・福祉",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_9_1",
        title: "青藍会グループ 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ymc",
        expectedCloseDate: "2026-01-23",
      },
    ],
    createdAt: daysAgo(192),
  },
  // record 8
  {
    id: "cust_8",
    name: "株式会社山口井筒屋",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "083-902-1111",
    address: "山口県山口県山口市中市町３?３",
    industry: "小売・EC",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_8_1",
        title: "株式会社山口井筒屋 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ymc",
        expectedCloseDate: "2026-01-05",
      },
    ],
    createdAt: daysAgo(53),
  },
  // record 7
  {
    id: "cust_7",
    name: "株式会社レノファ山口",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "083-941-6792",
    address: "山口県山口県山口市赤妻町3-5",
    industry: "その他",
    branchId: "branch_ymc",
    branch: BRANCH_MAP.branch_ymc,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_7_1",
        title: "株式会社レノファ山口 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_ymc",
        expectedCloseDate: "2025-11-02",
      },
    ],
    createdAt: daysAgo(153),
  },
  // record 6
  {
    id: "cust_6",
    name: "金沢市市民局",
    nameKana: "",
    contactName: null,
    email: null,
    phone: null,
    address: "石川県",
    industry: "官公庁・自治体",
    branchId: "branch_isk",
    branch: BRANCH_MAP.branch_isk,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_6_1",
        title: "金沢市市民局 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_isk",
        expectedCloseDate: "2025-10-24",
      },
    ],
    createdAt: daysAgo(85),
  },
  // record 5
  {
    id: "cust_5",
    name: "ビジネスエンジニアリング株式会社",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "03-3510-1590",
    address: "東京都東京都千代田区大手町1-8-1KDDI大手町ビル",
    industry: "IT・Web・通信",
    branchId: "branch_hq",
    branch: BRANCH_MAP.branch_hq,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_5_1",
        title: "ビジネスエンジニアリング株式会社 継続サポート",
        amount: null,
        status: "CLOSED_WON",
        branchId: "branch_hq",
        expectedCloseDate: "2025-10-19",
      },
    ],
    createdAt: daysAgo(127),
  },
  // record 2
  {
    id: "cust_2",
    name: "株式会社バンダイナムコネットワークサービス",
    nameKana: "",
    contactName: null,
    email: null,
    phone: "03-6744-4115",
    address: "東京都港区芝五丁目37-8バンダイナムコ来研究所",
    industry: "エンタメ・レジャー",
    branchId: "branch_hq",
    branch: BRANCH_MAP.branch_hq,
    lockedByName: null,
    lockExpiresAt: null,
    deals: [
      {
        id: "deal_2_1",
        title: "イベント集客デジタル広告",
        amount: null,
        status: "PROPOSAL",
        branchId: "branch_hq",
        expectedCloseDate: "2026-03-15",
      },
    ],
    createdAt: daysAgo(22),
  },
];

// ---------------------------------------------------------------
// Phase 1: メールアドレスからモック branchId を取得
// Phase 2: DB の users テーブルから取得する
// ---------------------------------------------------------------
export function getMockBranchId(
  email: string,
  role: UserRole
): string | null {
  if (role === "ADMIN") return null; // 本部 = 全拠点
  return EMAIL_TO_BRANCH[email.toLowerCase()] ?? null;
}

// ---------------------------------------------------------------
// 商談金額マスキング
// ADMIN(branchId=null): 全額表示
// MANAGER: 自拠点のみ表示、他拠点は "***"
// ---------------------------------------------------------------
export function maskAmount(
  amount: number | null,
  userBranchId: string | null,
  dealBranchId: string
): { display: string; masked: boolean } {
  const format = (n: number) => "¥" + n.toLocaleString("ja-JP");
  if (amount === null) return { display: "—", masked: false };
  if (userBranchId === null) return { display: format(amount), masked: false };
  if (userBranchId === dealBranchId) return { display: format(amount), masked: false };
  return { display: "***", masked: true };
}

// ---------------------------------------------------------------
// 顧客リストのフィルタリング
// ---------------------------------------------------------------
export function getFilteredCustomers(params: {
  query: string;
  branchFilter: string;
}): DummyCustomer[] {
  let result = [...DUMMY_CUSTOMERS];
  if (params.query) {
    const q = params.query.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameKana.includes(q) ||
        c.contactName?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q)
    );
  }
  if (params.branchFilter) {
    result = result.filter((c) => c.branchId === params.branchFilter);
  }
  return result;
}

// ---------------------------------------------------------------
// ステータス表示ラベル
// ---------------------------------------------------------------
export const DEAL_STATUS_LABELS: Record<DealStatus, { label: string; className: string }> = {
  PROSPECTING: { label: "見込み",  className: "bg-zinc-100 text-zinc-600" },
  QUALIFYING:  { label: "検討中",  className: "bg-blue-100 text-blue-700" },
  PROPOSAL:    { label: "提案中",  className: "bg-yellow-100 text-yellow-700" },
  NEGOTIATION: { label: "交渉中",  className: "bg-orange-100 text-orange-700" },
  CLOSED_WON:  { label: "受注",    className: "bg-emerald-100 text-emerald-700" },
  CLOSED_LOST: { label: "失注",    className: "bg-red-100 text-red-600" },
};
