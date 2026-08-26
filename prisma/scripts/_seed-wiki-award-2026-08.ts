// 広告賞ファインダーの使い方（Wiki記事）を1本追加する。既存タイトルがあればスキップ。
//   npx tsx prisma/scripts/_seed-wiki-award-2026-08.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const UPDATE_TAG = "2026年8月更新";
const UPDATE_TAG_COLOR = "#f59e0b";
const CATEGORY_TAG = "営業支援";
const CATEGORY_TAG_COLOR = "#10b981";

const ARTICLE = {
  title: "広告賞ファインダーの使い方 — 制作物に「受賞」の箔を付けて提案する",
  tagNames: [CATEGORY_TAG, UPDATE_TAG],
  body: `# 広告賞ファインダーの使い方

## この機能でできること
- 全国・地方・国際の広告賞（174件）の応募時期・応募料・対象・狙いやすさを一覧できる
- あなたの県の **地元の賞**（広告協会賞・地方紙の広告賞・ラジオ局のCMコンテスト等）が最初に出る
- 「受付中・締切まで◯日」「次回◯月〜」の順に並ぶので、提案のタイミングに合う賞をすぐ選べる
- 「提案文をコピー」で、賞の名前・応募時期・応募料を1行にして提案書へ貼れる

## 基本的な使い方
1. サイドバー「営業」から **広告賞ファインダー** を開く（都道府県はあなたの拠点県が初期値）
2. 「制作物の種類」で TVCM／WEB動画／新聞／OOH交通 など、これから作るものを選ぶ
3. **◎（地元・応募すれば入賞圏）** から見る。地元の賞は「県内で掲出・放送された広告」なら応募でき、応募料は無料〜数千円が大半
4. 気に入った賞の「提案文をコピー」を押して、提案書に「◯◯賞へのエントリーまで含めてご提案します」の形で入れる
5. 受付中でなくても「次回◯月〜」を見て、制作スケジュールを締切に合わせる

## 提案での使い方
- 制作物そのものの価格は変えず、**「受賞狙いのエントリーまで込み」** を付加価値にする
- 受賞後の使い道まで一緒に出すと通りやすい：地元紙への掲載・表彰式にクライアントも登壇・受賞マークを自社サイトや名刺に
- 全国賞（ACC・新聞広告賞など）は大手代理店中心＝△。地元の賞で実績を作り、次の提案で全国賞を狙う順番が現実的

## 読み方の注意
- 広告賞は毎年ほぼ同じ内容で **日程だけが変わる**。画面の日程は確認した年の実績で、翌年分は「次回◯月頃（前年実績）」と出る
- **「日程は要確認」** と付いている賞は、応募前に主催の公式ページか事務局へ確認する（地方の広告協会賞は応募期間を公開していないところが多い）
- 「存在未確認」と付いている賞は、存在自体を確認できていないもの。提案に入れる前に必ず主催へ確認する
- ◎○△の狙いやすさは本部の見立て。実際の競争率は年によって変わる

## 困ったとき
- 該当が0件のときは、都道府県を「指定しない」にするか、範囲を「地元＋全国」「国際も含む」に広げる
- 賞の追加・日程の修正は本部（白川）まで。年1回、日程だけ更新する
`,
};

async function ensureTag(name: string, color: string): Promise<string> {
  const tag = await db.wikiTag.upsert({ where: { name }, update: {}, create: { name, color } });
  return tag.id;
}

async function main() {
  const hq = await db.branch.findFirst({ where: { id: "branch_hq" } });
  if (!hq) throw new Error("Branch branch_hq が見つかりません");
  const tagIds = [
    await ensureTag(CATEGORY_TAG, CATEGORY_TAG_COLOR),
    await ensureTag(UPDATE_TAG, UPDATE_TAG_COLOR),
  ];
  const existing = await db.wikiArticle.findFirst({ where: { title: ARTICLE.title } });
  if (existing) {
    console.log(`SKIP (exists): ${ARTICLE.title}`);
    return;
  }
  const a = await db.wikiArticle.create({
    data: {
      title: ARTICLE.title,
      body: ARTICLE.body,
      authorName: "白川 裕喜",
      branchId: hq.id,
      tags: { connect: tagIds.map((id) => ({ id })) },
    },
  });
  console.log(`OK: ${a.id} ${ARTICLE.title}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
