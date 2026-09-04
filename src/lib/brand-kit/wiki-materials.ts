// ==============================================================
// ブランドキット — Wiki記事 → AI用材料
//   タグ「AI材料」を付けた本部Wiki記事（branch_hq）が、そのまま材料として一覧に並ぶ。
//   本部がWikiを書けば材料が増える仕組み。第1号は「TVer出稿の最新ルール」。
// ==============================================================

import { db } from "@/lib/db";
import { commonGuidelines, senderBlock, todayLabel } from "./common";
import type { MaterialSender } from "./material";

export const WIKI_MATERIAL_TAG = "AI材料";
export const HQ_BRANCH_ID = "branch_hq";

export interface WikiMaterialRow {
  id: string;
  title: string;
  updatedAt: Date;
  body: string;
}

export async function listWikiMaterials(): Promise<{ id: string; title: string; updatedAt: Date; body: string }[]> {
  const rows = await db.wikiArticle.findMany({
    where: { branchId: HQ_BRANCH_ID, tags: { some: { name: WIKI_MATERIAL_TAG } } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, body: true },
  });
  return rows;
}

export async function getWikiMaterial(id: string) {
  return db.wikiArticle.findFirst({
    where: { id, branchId: HQ_BRANCH_ID, tags: { some: { name: WIKI_MATERIAL_TAG } } },
    select: { id: true, title: true, updatedAt: true, body: true },
  });
}

export function buildWikiMaterial(article: WikiMaterialRow, sender: MaterialSender | null, root: string): string {
  const asOf = todayLabel();
  const updated = article.updatedAt.toLocaleDateString("ja-JP");
  return `# ${article.title}｜AI用の材料　${asOf}版（Ad Arch OS の社内Wikiから自動生成・記事の更新日 ${updated}）

> 本部のWiki記事をそのまま材料にしたものです。記事が更新されると、この材料も次に開いたときから新しくなります。
> ▶️ 記事（OS・ログイン必須）: ${root}/dashboard/wiki/${article.id}

---

## 1. あなたの会社（差出人）　※空欄だけ自分で埋める

${senderBlock(sender)}

---

## 2. 記事の内容（本部Wikiそのまま）

${article.body.trim()}

---

## 3. 言ってよいこと・言ってはいけないこと

${commonGuidelines()}

**この材料の注意**
- 記事に「本部確認」とある事項は、お客様に断言せず本部に確認する
- 記事の数字・条件が他の材料と食い違うときは、新しい更新日のほうを使い、本部に知らせる

---

## 4. 指示文

**A. 要点を3行に**
「上の記事の内容を、お客様に伝える3行にまとめてください。数字は記事のまま、断言は避ける。」

**B. お客様への説明文**
「上の記事の内容で、＜会社名＞に＜テーマ＞を説明するメール文を8〜12行で。本部確認の事項は『確認のうえご案内します』と書く。」

---

## 5. この材料について
- 出どころ: Ad Arch OS 社内Wiki（本部記事・タグ「${WIKI_MATERIAL_TAG}」）。記事の更新日 ${updated}
- 材料を増やすには: 本部がWiki記事にタグ「${WIKI_MATERIAL_TAG}」を付ける`;
}
