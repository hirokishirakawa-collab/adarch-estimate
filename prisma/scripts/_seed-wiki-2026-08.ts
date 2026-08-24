import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

type Article = { title: string; body: string; tagNames: string[] };

const UPDATE_TAG = "2026年8月更新";
const UPDATE_TAG_COLOR = "#f59e0b";
const CATEGORY_TAG = "営業支援";
const CATEGORY_TAG_COLOR = "#10b981";

const ARTICLES: Article[] = [
  {
    title: "入札ファインダーの使い方",
    tagNames: [CATEGORY_TAG, UPDATE_TAG],
    body: `# 入札ファインダーの使い方

## この機能でできること
- 全国の自治体・官公庁が公告した入札案件のうち、広告・映像・印刷・イベント系のものを自動で集めて一覧できる
- AIが「○（グループが取れる仕事）／△（周辺業務）／×（対象外）」を判定し、判断理由の1行つきで表示

## 基本的な使い方
1. サイドバー「営業」から **入札ファインダー** を開く
2. まず **○判定** の案件から見る（広告・映像・印刷・イベントの発注）
3. 各案件の「判定理由」と公告のリンクを確認する
4. 気になる案件は公告本文（PDF/HTML）で仕様・締切・参加条件を必ず確認する

## 注意点
- **入札参加資格（名簿登録）が必要な案件があります**。「資格が要る」と表示された案件は、その自治体への事前登録が前提です
- 開札日・締切は公告データに入っていない自治体もあり、推定日で一覧から落ちることがあります。応札するときは必ず原文の日付を確認してください
- 現状は国の機関の案件が多めです。市町村案件は少なめですが、地元案件が出たら競合が少ない好機です

## こんなときに使う
- 月初に「今月狙える公的案件があるか」をまとめて見るとき
- 制作の谷間に、単発でない公的仕事を仕込みたいとき
`,
  },
  {
    title: "補助金ファインダーの使い方 — クライアントの広告費の財源を探す",
    tagNames: [CATEGORY_TAG, UPDATE_TAG],
    body: `# 補助金ファインダーの使い方

## この機能でできること
- 「クライアントの広告費・動画制作費の財源になり得る補助金」を全国から自動で集めて一覧できる
- AIと本部の確認で「◎／○／△／×」の適合度がついています

## 判定マークの意味（ここが大事）
- **◎**: 本部が公募要領を実際に読み、広告費・広報費が対象と確認できている制度
- **○**: 販路開拓・広報・PR系で対象になる可能性が高い制度（**公募要領での確認が必要**）
- **△／×**: 判断材料不足／広告費が対象外と読める制度

## 基本的な使い方
1. サイドバー「営業」から **補助金ファインダー** を開く
2. クライアントの所在地（都道府県）と◎○で絞り込む
3. 商談では「この制度が使えます」と断言せず、**「広告費に使える可能性のある制度があります。公募要領を一緒に確認しましょう」**という提案にする

## 提案トークの例
- 「動画制作費や媒体掲載費が補助対象になる制度が出ています。対象になれば実質のご負担を抑えて始められます」
- 予算がネックで止まっている商談の再訪のきっかけに使えます

## 注意点
- **制度の適用可否は必ず公募要領で確認**してください。締切・対象経費・申請要件は制度ごとに違います
- 申請そのものの代行は行いません（士業の独占業務に関わるため）。申請はクライアント自身か専門家への依頼が前提です
`,
  },
  {
    title: "周年ファインダーの使い方 — 節目の会社に「地元で目立つ」を売る",
    tagNames: [CATEGORY_TAG, UPDATE_TAG],
    body: `# 周年ファインダーの使い方

## この機能でできること
- OSに登録されたリードのうち、**5年刻みの周年**（とくに10・20・30・50・100周年などの節目）を迎える会社を出典つきで一覧できる
- 「3ヶ月以内」「今年」で絞り込み、チェック選択 → CSV書き出し／営業フォーム／メール送付へそのまま進める

## 基本的な使い方
1. サイドバー「営業」から **周年ファインダー** を開く
2. まず「3ヶ月以内」の会社から見る（記念行事・広告の予算が動きやすいタイミング）
3. 当たりたい会社にチェックを入れ、**営業フォームへ／メール送付へ** ボタンでアウトリーチ画面へ
4. 文面では「創業◯年の節目」という切り口で、地元での認知（TVer等の商圏広告・周年動画）を提案する

## 注意点（必ず守る）
- 設立年は**登記情報ではなく、相手の会社概要ページ等から取得したもの**です。各行に出典リンクがあります
- 客先では「登記上◯年ですね」と断言せず、**「サイトで拝見したのですが、来年◯周年でいらっしゃいますか？」**という確認の形で切り出してください

## こんなときに使う
- 今月のアプローチ先リストを作るとき（周年×地元広告は刺さりやすい組み合わせです）
- 提案の「なぜ今か」に説得力を持たせたいとき
`,
  },
  {
    title: "送付結果の記録（4ボタン）と「受注」の月次報告への取り込み",
    tagNames: [CATEGORY_TAG, UPDATE_TAG],
    body: `# 送付結果の記録と月次報告への取り込み

## この機能でできること
- 営業を送った先の結果を **1クリック** で記録できる（返信あり／返信NG／無反応／断り／受注 🎉）
- 結果は自動で **グループの事例DB（アプローチ事例集）** に匿名で蓄積され、全社の営業の精度が上がる
- 「受注 🎉」にしたリードは、**月次報告の作成画面に候補として表示**され、クリックで明細に1行入る（金額だけ入力）

## 基本的な使い方
1. **返事待ち一覧**（リード管理 → 返事待ち）を開く
2. 返事が来たら該当の会社で結果ボタンを押す — これだけで完了
3. 受注できたら「受注 🎉」を押す → 月初の月次報告で候補から取り込む

## なぜ押してほしいのか
- 結果を押すと、業種・送付方法・文面が**自動で**グループ事例に残ります（入力の手間はありません）
- 「どの業種に何を送ると返ってくるか」が全社に共有され、アウトリーチ画面の「反応の良かった文面」がどんどん賢くなります

## 注意点
- 追いかけメールの自動送信は行いません。再アプローチのタイミングはご自身の判断です
`,
  },
  {
    title: "リード管理からのメール送付（アウトリーチ）",
    tagNames: [CATEGORY_TAG, UPDATE_TAG],
    body: `# リード管理からのメール送付

## この機能でできること
- リード管理で会社を選択 → **「メール送付：アウトリーチへ」** ボタンで、メールアドレス取得済みの会社だけをアウトリーチ画面に送れる
- アウトリーチ画面の各社カードの **「メールで送る↗」** をクリックすると、**件名と営業文の入ったメール下書き**がお使いのメールソフトでそのまま開く

## 基本的な使い方
1. リード管理（またはシグナル順の一覧・周年ファインダー）で当たりたい会社にチェック
2. メールアドレスが未取得なら、先に **「メールを取得」** を押す（相手サイトに記載のあるアドレスだけを取り込みます。推測はしません）
3. **「メール送付：アウトリーチへ」** を押す
4. アウトリーチ画面で訴求（広告媒体／動画制作など）を選び、文面を調整
5. **「メールで送る↗」** で下書きを開き、内容を確認して**ご自身で送信**
6. 送ったら「送付済み」を押す → 返事が来たら結果4ボタンへ

## 注意点
- 送信は必ずご自身の手で行ってください（自動送信はありません）
- 営業お断りの記載がある会社には送付ボタン・メールリンクが出ません。お断り表記を見つけたら「お断り登録」で全社に共有してください
`,
  },
];

async function ensureTag(name: string, color: string): Promise<string> {
  const tag = await db.wikiTag.upsert({
    where: { name },
    update: {},
    create: { name, color },
  });
  return tag.id;
}

async function main() {
  console.log("Wiki seed (2026-08) start...");

  const hq = await db.branch.findFirst({ where: { id: "branch_hq" } });
  if (!hq) throw new Error("Branch branch_hq が見つかりません");

  const tagNameToId = new Map<string, string>();
  tagNameToId.set(UPDATE_TAG, await ensureTag(UPDATE_TAG, UPDATE_TAG_COLOR));
  tagNameToId.set(CATEGORY_TAG, await ensureTag(CATEGORY_TAG, CATEGORY_TAG_COLOR));

  const existingTags = await db.wikiTag.findMany();
  for (const t of existingTags) tagNameToId.set(t.name, t.id);

  let created = 0;
  let skipped = 0;
  for (const a of ARTICLES) {
    const existing = await db.wikiArticle.findFirst({ where: { title: a.title } });
    if (existing) {
      console.log(`  SKIP: ${a.title}`);
      skipped++;
      continue;
    }
    const tagIds = a.tagNames
      .map((n) => tagNameToId.get(n))
      .filter((id): id is string => !!id);
    await db.wikiArticle.create({
      data: {
        title: a.title,
        body: a.body,
        authorName: "白川 裕喜",
        branchId: hq.id,
        tags: { connect: tagIds.map((id) => ({ id })) },
      },
    });
    console.log(`  OK : ${a.title}  [${a.tagNames.join(",")}]`);
    created++;
  }

  console.log(`Done! created=${created}, skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
