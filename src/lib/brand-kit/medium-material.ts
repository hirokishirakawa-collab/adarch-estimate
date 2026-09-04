// ==============================================================
// ブランドキット — 媒体メニュー1件 → AI用材料（Markdown）
//   価格は src/lib/media/<id>.ts（シミュレーターと共通の正本）から組む。
// ==============================================================

import type { MediumDef } from "@/lib/media";
import { commonGuidelines, commonPrompts, senderBlock, todayLabel } from "./common";
import { renderGroupData, type GroupDataSummary } from "./group-data";
import type { MaterialSender } from "./material";

export const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSciTzeslvAflSqWPQ7aP3zowNHrqdM5d0B-IH-DQPYASfS8vg/viewform";

export interface MediumMaterialInput {
  medium: MediumDef;
  sender: MaterialSender | null;
  simulatorUrl: string;
  groupData: GroupDataSummary;
}

export function buildMediumMaterial(input: MediumMaterialInput): string {
  const { medium, sender, simulatorUrl, groupData } = input;
  const asOf = todayLabel();
  const pref = sender?.prefecture ?? null;
  const sections: string[] = [];

  sections.push(`# ${medium.name}｜AI用の材料　${asOf}版${pref ? `・${pref}` : "・全国"}（Ad Arch OS から自動生成）

> このファイルを、お使いのAI（Claude / ChatGPT / Gemini）に丸ごと貼ってから、最後の「指示文」のどれかを送ってください。
> 価格の正本は Ad Arch OS のシミュレーターです。個別の組み合わせの金額はシミュレーターで出してください（この材料は代表的な金額だけ）。
> ▶️ シミュレーター（OS・ログイン必須）: ${simulatorUrl}`);

  sections.push(`## 1. あなたの会社（差出人）　※空欄だけ自分で埋める\n\n${senderBlock(sender)}`);

  sections.push(`## 2. メニューの事実（OSのシミュレーターと同じ数字）

**名前**: ${medium.name}
**一言**: ${medium.short}

**内容**
${medium.what}

**向いている相手**
${medium.fits}

${medium.facts(pref)}`);

  sections.push(`## 3. エリア別の目安\n\nこの媒体は、金額を出すときは必ずOSのシミュレーターで組んでください。上の表は「代表的な組み方の販売価格」です。お客様に出す金額は、シミュレーターのPDF（本部の様式）を使います。`);

  sections.push(`## 4. 言ってよいこと・言ってはいけないこと\n\n${commonGuidelines()}\n\n**この媒体の注意**\n${medium.caveats.map((c) => `- ${c}`).join("\n")}`);

  sections.push(`## 5. 営業の型\n\n**切り口**\n${medium.talk.map((t) => `- ${t}`).join("\n")}`);

  sections.push(`## 6. 指示文（この中から1つ選んで送る。＜＞を埋める）\n\n${commonPrompts({ feedbackUrl: FEEDBACK_FORM_URL, hasAreaTable: false })}`);

  sections.push(`## 7. グループの実データ（匿名集計）\n\n${renderGroupData(groupData, asOf)}`);

  sections.push(`## 8. この材料について
- 出どころ: Ad Arch OS のシミュレーター（${medium.simulatorPath}）と同じ料金データ、アプローチ事例・商談・ヒアリングの記録。${asOf}時点のOSから自動生成
- 更新: OSの「ブランドキット」を開くたびに最新。古いコピーの数字は使わない
- 感想・困った点: ${FEEDBACK_FORM_URL}（1分・指示文Fの3行を貼るだけ）
- 困ったら: OSの「みんなのチャット」で聞く`);

  return sections.join("\n\n---\n\n");
}
