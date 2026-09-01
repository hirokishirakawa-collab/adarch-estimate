/**
 * パッケージ台帳 初期3本（2026-09-01 代表決定）
 *   ・全て「提案中」。価格は空欄（代表がOS上で入れて「稼働中」にする）
 *   ・中身は本部の案（出どころの個人名はOSに出さない）
 *   ・同じ slug があれば触らない（二重投入しない）
 *
 * 実行:
 *   npx tsx prisma/scripts/seed-sales-packages.ts            → ドライラン（内容表示のみ）
 *   npx tsx prisma/scripts/seed-sales-packages.ts --execute  → 投入
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const PACKAGES = [
  {
    slug: "recruit-video",
    name: "採用動画パッケージ",
    tagline: "求人票では伝わらない「働く姿」を90秒で",
    category: "採用",
    targetIndustries: ["建設", "介護・福祉", "運送", "製造", "飲食", "小売"],
    painPoints:
      "求人媒体に出しても応募が来ない。来ても職場の雰囲気が伝わらず、面接前に辞退される。\n若い人はまず動画で会社を見るのに、会社側に動画が1本もない。",
    summary:
      "社員インタビューと現場の映像を軸にした採用動画（90秒）を1本、SNS・求人ページ向けの縦型ショート3本、求人ページに貼るための書き出し一式をお届けします。撮影は半日、御社の準備は「話してくれる社員2〜3名」だけです。",
    deliverables: [
      { name: "採用動画（90秒・横型）", qty: 1, unit: "本", spec: "社員インタビュー2〜3名＋現場カット・字幕付き・BGM込み" },
      { name: "縦型ショート動画（15〜30秒）", qty: 3, unit: "本", spec: "Instagram / TikTok / 求人SNS用に切り出し" },
      { name: "求人ページ用の書き出し", qty: 1, unit: "式", spec: "YouTube限定公開URL＋mp4＋サムネイル画像" },
      { name: "撮影（半日）", qty: 1, unit: "回", spec: "御社1拠点・カメラマン1名・インタビュー進行込み" },
    ],
    leadTime: "撮影日から3週間で納品（撮影日は発注から2週間以内に設定）",
    options: [
      { name: "追加拠点の撮影", price: null, note: "2拠点目以降（移動込み）" },
      { name: "求人サイト用の静止画セット", price: null, note: "撮影時のスチール10点" },
      { name: "TVer／サイネージでの配信", price: null, note: "地域リーチ固定パッケージへ接続" },
    ],
    priceType: "ONE_TIME" as const,
    fulfillment: [
      { task: "営業・ヒアリング・見積・契約", owner: "BRANCH" as const, note: "販売した拠点が窓口。撮影日の調整まで" },
      { task: "撮影・編集・納品データ作成", owner: "PRODUCER" as const, note: "グループ内の制作代表へ発注（本部が紹介）" },
      { task: "納品前チェック（規定どおりか）", owner: "HQ" as const, note: "本部が事前に1回確認" },
      { task: "納品後のフォロー（求人ページ設置の案内）", owner: "BRANCH" as const, note: "設置は先方作業。困っていたら本部に相談" },
    ],
    pitchText:
      "{name}様の採用のお手伝いとして、採用動画パッケージのご提案ができればと考えております。社員インタビューと現場の映像で「働く姿」を90秒にまとめ、SNS向けの縦型ショート3本と求人ページ用の書き出しまで一式でお届けします。撮影は半日、御社のご準備は話してくださる社員の方2〜3名だけです。内容と価格を固定したパッケージですので、ご検討いただきやすいかと存じます。",
    talkTrack:
      "・最初の質問: 「いま求人はどこに出していますか？」→ 媒体費に対して応募が少ない話が出やすい\n・刺さる言い方: 「求人票は条件、動画は空気。空気で選ばれる時代です」\n・よくある反論「うちは地味な仕事だから」→ 「地味な仕事ほど、実際に働く人の顔が決め手になります」\n・決め手: 撮影半日・準備は社員2〜3名だけ、を強調（負担が軽い）",
    rules:
      "・値引きは本部確認なしで5%まで。それ以上は本部へ\n・「採用保証」「応募数の約束」は言わない\n・動画尺は90秒を基準（±15秒まで）。長尺化は別見積\n・出演社員の肖像使用は先方が同意書を取る（雛形は本部）\n・納品前に本部チェックを必ず通す（グループ統一の品質）",
    caseStudies: "",
    proposalNote: "本部起案（2026-09）。求人媒体に出しても応募が来ない企業向けに、内容と価格を固定して売りやすくした型。",
  },
  {
    slug: "storefront-signage",
    name: "路面店サイネージセット",
    tagline: "店頭の一番いい場所を、動く広告面に",
    category: "サイネージ",
    targetIndustries: ["飲食", "美容室・サロン", "整骨院・クリニック", "小売", "不動産店舗", "学習塾"],
    painPoints:
      "店の前を毎日たくさん人が通るのに、看板もポスターも見られていない。\nメニューやキャンペーンを変えるたびに印刷し直すのが面倒で、結局古いままになっている。",
    summary:
      "店頭用のディスプレイ端末（Panelize）を設置し、御社専用の店頭動画を1本制作、OSから配信・差し替えができる状態でお渡しします。月額で運用・配信・差し替えをまとめてお引き受けするので、キャンペーンごとの印刷が不要になります。",
    deliverables: [
      { name: "店頭サイネージ端末（設置込み）", qty: 1, unit: "台", spec: "Panelize・縦型・店頭ガラス面／カウンター" },
      { name: "店頭動画（15〜30秒・縦型）", qty: 1, unit: "本", spec: "メニュー／サービス紹介・文字メイン・音なし前提" },
      { name: "配信設定・初期投入", qty: 1, unit: "式", spec: "Ad Arch OSから配信。差し替えは月1回まで込み" },
      { name: "月次の運用（差し替え・稼働確認）", qty: 1, unit: "月", spec: "月額に含む" },
    ],
    leadTime: "発注から3週間で設置・配信開始",
    options: [
      { name: "店頭動画の追加制作", price: null, note: "季節キャンペーン用など" },
      { name: "2台目以降の端末", price: null, note: "同一店舗内" },
      { name: "近隣店舗との相互配信", price: null, note: "地域の店同士で枠を交換" },
    ],
    priceType: "INITIAL_PLUS_MONTHLY" as const,
    fulfillment: [
      { task: "営業・設置場所の確認・契約", owner: "BRANCH" as const, note: "設置面（電源・ガラス面）を写真で確認" },
      { task: "端末手配・配信設定", owner: "HQ" as const, note: "Panelize発注とOS側の登録は本部" },
      { task: "店頭動画の制作", owner: "PRODUCER" as const, note: "制作代表へ発注（拠点が制作できる場合は自社でも可）" },
      { task: "設置・初回稼働確認", owner: "BRANCH" as const, note: "本部の手順書どおり" },
      { task: "月次の差し替え・故障一次対応", owner: "BRANCH" as const, note: "端末の故障は本部が交換手配" },
    ],
    pitchText:
      "{name}様の店頭で、路面店サイネージセットのご提案ができればと考えております。店頭にディスプレイを設置し、御社専用の店頭動画を1本制作、メニューやキャンペーンの差し替えまで月額でお引き受けするものです。印刷し直す手間がなくなり、店の前を通る方に毎日動く画面で伝えられます。初期費用と月額を固定したセットですので、ご検討いただきやすいかと存じます。",
    talkTrack:
      "・最初の質問: 「店頭のポスター、最後に替えたのはいつですか？」\n・刺さる言い方: 「一番人が通る場所が、一番古い情報になっていませんか」\n・反論「電気代と場所が」→ 端末は小さく消費電力も小さい。設置面の写真を見て、その場で置き場所を提案\n・決め手: 月1回の差し替えが込み＝季節ごとに勝手に新しくなる",
    rules:
      "・端末の販売価格は全拠点で統一（値引きは本部確認）\n・月額には差し替え月1回・稼働確認を含む。それ以上は追加\n・音出し前提の動画は作らない（店頭は無音が基本）\n・端末の所有と保守条件は契約書の統一条項を使う（本部雛形）\n・最低契約期間は本部規定に従う",
    caseStudies: "",
    proposalNote: "本部起案（2026-09）。店頭の一等地を動く広告面にする型。本部のPanelize端末を各拠点が売れる形に。",
  },
  {
    slug: "local-reach-tver",
    calculator: "tver-area", // 詳細・公開ページに「市を選ぶと月額別の到達人数・住民比」の表を出す
    name: "地域リーチ固定パッケージ",
    tagline: "「○○市に、月に何回届けるか」を固定額で",
    category: "TVer",
    targetIndustries: ["住宅・リフォーム", "自動車販売", "クリニック", "学習塾", "葬祭", "地域小売", "採用中の企業"],
    painPoints:
      "テレビCMは高すぎる。ネット広告は運用が難しく、何に効いているのか分からない。\n「うちの市の人に、ちゃんと届いているか」が知りたいだけなのに、代理店の説明が複雑すぎる。",
    summary:
      "御社の商圏（市単位）を指定し、TVerで月に届ける回数を固定して、月額固定でお届けします。配信設定・月次のレポートは本部が行い、御社は動画（15秒）を用意するだけ。動画がなければ制作もセットにできます。",
    deliverables: [
      { name: "TVer配信（市単位・月間の再生数固定）", qty: 1, unit: "月", spec: "15秒・指定市を中心に配信。再生数の目安は本部が商圏ごとに提示" },
      { name: "配信設定・入稿", qty: 1, unit: "式", spec: "本部が実施。動画の規定チェック込み" },
      { name: "月次レポート", qty: 1, unit: "回", spec: "再生数・完全視聴率・エリア内訳を1枚で" },
    ],
    leadTime: "動画受領から10営業日で配信開始",
    options: [
      { name: "15秒動画の制作", price: null, note: "動画がない場合。採用動画パッケージからの切り出しも可" },
      { name: "隣接市の追加", price: null, note: "商圏を広げる" },
      { name: "30秒への延長", price: null, note: "単価は本部規定（15秒の2倍）" },
    ],
    priceType: "MONTHLY" as const,
    fulfillment: [
      { task: "営業・商圏（市）の決定・契約", owner: "BRANCH" as const, note: "OSのTVerシミュレーターで市を選んで提示" },
      { task: "配信設定・入稿・運用・月次レポート", owner: "HQ" as const, note: "手離れ最良。放映開始後は拠点はほぼノータッチ" },
      { task: "15秒動画の制作（オプション）", owner: "PRODUCER" as const, note: "制作代表へ発注" },
      { task: "月次レポートの手渡し・次月の提案", owner: "BRANCH" as const, note: "継続（MRR）の要" },
    ],
    pitchText:
      "{name}様の集客のお手伝いとして、地域リーチ固定パッケージのご提案ができればと考えております。御社の商圏を市単位で指定し、TVer（民放公式のテレビ配信サービス）で月に届ける回数を固定して、月額固定でお届けするものです。配信の設定と毎月のレポートは当社が行いますので、御社は15秒の動画をご用意いただくだけ（制作もお引き受けできます）。小さく始めて、効いていれば商圏を広げる、という進め方ができます。",
    talkTrack:
      "・最初の質問: 「お客さまは、だいたいどの市からいらっしゃいますか？」→ その市の名前でシミュレーターを見せる\n・刺さる言い方: 「テレビCMを、御社の市だけに絞って出せます」\n・反論「効果が分からない」→ 月次レポート1枚（再生数・エリア内訳）を実物で見せる\n・決め手: 月額固定・いつでも止められる・動画は使い回せる",
    rules:
      "・販売単価は本部規定（15秒 ¥6.6/再生＝卸値×3）。拠点が単価を変えない\n・「○○人にリーチ」は再生数の目安として言い、保証しない\n・媒体名（TVer）は「民放公式のテレビ配信サービス」と添えて説明する\n・最低契約は1ヶ月から。年間契約の割引は本部確認\n・月次レポートは本部の様式のみ使う（数字の改変禁止）",
    caseStudies: "",
    proposalNote: "本部起案（2026-09）。市単位・月額固定でTVerを売る型。設定と報告は本部＝手離れが良く固定収益になる。",
  },
];

async function main() {
  const execute = process.argv.includes("--execute");
  console.log(`[seed-sales-packages] ${execute ? "EXECUTE" : "DRY RUN"} — ${PACKAGES.length}本`);
  for (const p of PACKAGES) {
    const exists = await db.salesPackage.findUnique({ where: { slug: p.slug }, select: { id: true } });
    console.log(`- ${p.name} (${p.slug}) ${exists ? "→ 既にあるので触らない" : "→ 投入"}`);
    if (!execute || exists) continue;
    await db.salesPackage.create({
      data: {
        ...p,
        status: "PROPOSED",
        initialPrice: null,
        monthlyPrice: null,
        docs: [],
        proposedById: null,
      },
    });
  }
  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
