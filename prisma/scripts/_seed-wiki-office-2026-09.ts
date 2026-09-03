// グループライブ（みんなのチャット）のWiki記事を投入する（2026-09-03）
//   アーチくん（右下ヘルプ／チャットの仲間）は Wiki を引いて答えるので、記事がないと案内できない
//   同じ題名があればスキップ（二重投入しない）
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }) });

const UPDATE_TAG = "2026年9月更新";
const UPDATE_TAG_COLOR = "#f59e0b";
const CATEGORY_TAG = "ヘルプガイド";

const TITLE = "グループライブ（みんなのチャット）の使い方 — 一緒に動いている感じを共有する場所";
const BODY = `# グループライブ（みんなのチャット）の使い方

## この機能でできること
- **いま誰が動いているか**が日本地図に灯ります（OSを開いている間だけ点く＝常時在席は要りません）
- **みんなのチャット**で全員に一言を投げられます。ダッシュボードの一番上にも常に出ているので、/dashboard/live に入らなくても目に入ります
- **📎で案件を紐づけて聞く**と、答えがその商談・顧客・案件・パッケージのページに履歴として残り、後から加盟した人も読めます
- 投稿に**絵文字リアクション**（👍 ❤️ 🔥 👏 😂 🙏）を押せます
- 地図やチャットの顔を押すと、その人に**1対1の「ひとこと」**を送れます
- 誰も在席していない時の質問や「アーチくん」宛ての投稿には、**チャットのアーチくん**（AI）が仲間として返します

## 画面の場所
- サイドバー「グループライブ」 → **/dashboard/live**（地図＋右側にチャット）
- **ダッシュボード最上部**（/dashboard）にも同じチャットが出ます
- 商談・パッケージのページ下「グループチャットでの会話」＝その案件に紐づいた投稿だけ

## みんなのチャット
1. 入力欄に一言を書いて Enter（Shift+Enter で改行・300文字まで）
2. 「今日は◯◯市を回っています」「TVerの相談、誰か経験ありますか」——そんな一言で十分です
3. **金額・単価は書かない場所**です（全員に見えます）

## 絵文字リアクション（2026年9月追加）
- 投稿の右に出る **顔マーク（😊+）** を押すと 👍 ❤️ 🔥 👏 😂 🙏 の6種から選べます
- 押した絵文字は投稿の下に「絵文字＋人数」のチップで並びます。自分が押したものは緑枠。**もう一度押すと外れます**
- チップにカーソルを合わせると**押した人の名前**が見えます
- アーチくんの返答にも押せます（役に立った答えの目印になります）
- リアクションで**通知は飛びません**。気軽に押してください

## 📎 案件を紐づけて聞く
1. 入力欄の左の **📎** を押す
2. 「いま流れている動き」から選ぶか、顧客名・案件名・パッケージ名で検索するか、OSの画面URLを貼る
3. そのまま質問を書いて送る（例:「この商談の動線は何でしたか？」）
4. 答え（人の返事もアーチくんの材料も）がその案件のページに残ります
- 案件ページの「みんなに聞く」から開いた場合は、そのまま書けば自動で紐づきます
- 投稿の下の案件カードの「会話」を押すと、その案件の会話だけを見られます

## 1対1の「ひとこと」
- 地図のアバター、またはチャットの名前・顔を押す → 短いメッセージを送る
- 相手が在席中ならその場に届き、離席中なら通知ベルに載ります

## 顔アイコン
- **設定（/dashboard/settings）→「グループオフィスの顔」**で24種のアニメ風の顔から選べます（押すとすぐ保存）
- 選ばない場合は Google の写真が出ます

## アーチくん（チャットの仲間）
- 誰も在席していない時に「〜ですか？」のような質問を書くと、アーチくんが返します
- 「アーチくん、◯◯って何？」と宛名を付ければ、誰かがいても返します
- AIであることは隠しません。分からないことは分からないと言います。金額は書きません

## 本部の権限
- 本部だけが投稿を消せます（投稿にカーソルを合わせるとゴミ箱 → 「消す」）。消すと案件ページの会話からも消えます

## 注意点
- 音声通話はありません（テキストの声かけで足りる設計です）
- デモアカウント・停止中の拠点はチャットに出ません
`;

async function main() {
  const hq = await db.branch.findFirst({ where: { id: "branch_hq" } });
  if (!hq) throw new Error("Branch branch_hq が見つかりません");

  const existing = await db.wikiArticle.findFirst({ where: { title: TITLE } });
  if (existing) {
    console.log("SKIP（同じ題名がある）:", existing.id);
    return;
  }
  const upd = await db.wikiTag.upsert({ where: { name: UPDATE_TAG }, update: {}, create: { name: UPDATE_TAG, color: UPDATE_TAG_COLOR } });
  const cat = await db.wikiTag.findUnique({ where: { name: CATEGORY_TAG } });
  if (!cat) throw new Error(`タグ ${CATEGORY_TAG} が見つかりません`);

  const a = await db.wikiArticle.create({
    data: { title: TITLE, body: BODY, authorName: "白川 裕喜", branchId: hq.id, tags: { connect: [{ id: cat.id }, { id: upd.id }] } },
    select: { id: true },
  });
  console.log("OK:", a.id, "/dashboard/wiki/" + a.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
