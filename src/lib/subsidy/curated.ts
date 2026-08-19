// ==============================================================
// 手動キュレーション層 — 「広告費が対象」と断言してよい制度だけを人が登録する
//
// jGrants API の本文には対象経費が載っていない。
// つまり ◎（CONFIRMED）を付けられるのは、公募要領・官公庁の一次資料を
// 人が読んだ制度だけ。ここがこのツールの信頼性の全て。
//
// 【登録ルール】
//   - sourceUrl は官公庁・事務局の一次情報に限る（士業ブログ・まとめサイトは不可）
//   - checkedOn を必ず入れる。制度は毎年変わるので、古い確認日は画面に出す
//   - 「広告費が使える」だけでなく **制約** を必ず書く（上限・単独申請の可否・必須経費）
//     客先で使う道具なので、都合の良い面だけ載せると事故になる
// ==============================================================

import type { AdCostFit } from "@/generated/prisma/client";

export interface CuratedSubsidy {
  /** jGrants の title に含まれていればこの制度とみなすキーワード（全て含む必要がある） */
  matchAll: string[];
  /** 逆に含まれていたら別制度とみなす語 */
  matchNone?: string[];
  label: string;
  fit: AdCostFit;
  /** 画面に1行で出る結論 */
  reason: string;
  /** 制約・注意点。ここを読ませることで誤提案を防ぐ */
  caution: string;
  /** 一次情報のURL */
  sourceUrl: string;
  /** 内容を人が確認した日（YYYY-MM-DD） */
  checkedOn: string;
}

export const CURATED_SUBSIDIES: CuratedSubsidy[] = [
  {
    // 「一般型」でも災害支援枠・創業型は別制度（上限も締切も違う）。ここで弾かないと
    // 第20回の締切を別の枠に貼ってしまい、客先での誤案内になる。
    matchAll: ["持続化補助金", "一般型"],
    matchNone: ["共同", "協業", "災害", "創業"],
    label: "小規模事業者持続化補助金＜一般型・通常枠＞",
    fit: "CONFIRMED",
    reason:
      "広報費（チラシ・カタログ・新聞雑誌広告・看板・DM・街頭ビジョン/デジタルサイネージ）とウェブサイト関連費（HP・EC・SNS広告）が補助対象経費。",
    caution:
      "広報費・ウェブサイト関連費はそれぞれ上限30万円（税込）で、どちらも単独では申請できない（第20回）。全体の上限が特例で上がっても、この30万円は変わらない。第20回は受付 2026/11/5〜12/15 17:00、商工会議所・商工会が出す事業支援計画書（様式4）の受付締切は 2026/12/4 なので、実務上の締切は12月上旬。",
    sourceUrl:
      "https://www.chusho.meti.go.jp/koukai/hojyokin/kobo/2026/260527002.html",
    checkedOn: "2026-08-19",
  },
  {
    matchAll: ["新事業進出"],
    label: "中小企業新事業進出促進補助金",
    fit: "CONFIRMED",
    reason:
      "「広告（パンフレット、動画、写真等）の作成費」「広告の媒体掲載費」「展示会出展費」が補助対象経費（広告宣伝・販売促進費）。動画制作と媒体出稿が名指しで対象。",
    caution:
      "広告宣伝・販売促進費の上限は「事業計画期間1年あたりの新製品等の売上高見込み額（税抜）の5%」。また補助対象経費には機械装置・システム構築費または建物費のいずれかを必ず含む必要があるため、広告単体では申請できない。交付決定後の発注が前提で、相見積書が要る。補助金額は下限750万円・補助率1/2（特例2/3）。",
    sourceUrl: "https://shinjigyou-shinshutsu.smrj.go.jp/",
    checkedOn: "2026-08-19",
  },
  {
    matchAll: ["持続化補助金", "共同"],
    label: "小規模事業者持続化補助金＜共同・協業型＞",
    fit: "LIKELY",
    reason:
      "支援カテゴリーが「販路開拓」で、参画事業者の商品・サービスのブランディング支援や販路開拓の機会提供が対象事業。広報物・PRが事業内容に入りうる。",
    caution:
      "申請者は商工会等の「地域振興等機関」で、一般の事業者は申請者ではなく参画事業者側になる。申請者自身の販路開拓は対象外と明記されている。単なる観光PR・地域おこしも対象外。事業者を直接の申請主体として提案しないこと。",
    sourceUrl: "https://www.jgrants-portal.go.jp/",
    checkedOn: "2026-08-19",
  },
];

/**
 * jGrants の制度名に対して、キュレーション済みの制度を1件返す。
 * matchAll を全て含み、matchNone を1つも含まないものが該当。
 */
export function findCurated(title: string): CuratedSubsidy | null {
  // jGrants の制度名には「⼩規模事業者持続化補助⾦」のように康熙部首などの
  // 異体字が混ざる。NFKC で揃えてから突き合わせないと取りこぼす。
  const normalized = title.normalize("NFKC");
  for (const c of CURATED_SUBSIDIES) {
    const hitsAll = c.matchAll.every((kw) => normalized.includes(kw.normalize("NFKC")));
    if (!hitsAll) continue;
    const hitsNone = (c.matchNone ?? []).some((kw) =>
      normalized.includes(kw.normalize("NFKC")),
    );
    if (hitsNone) continue;
    return c;
  }
  return null;
}
