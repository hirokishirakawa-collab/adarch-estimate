// ==============================================================
// ブランドキット — 営業の言い回し集（AI用材料）
//   本部の型（固定）＋ OSの記録からの自動抽出（匿名化）。
//   自由記述は maskFreeText で社名・個人名・金額を伏せる。
// ==============================================================

import { db } from "@/lib/db";
import { commonGuidelines, senderBlock, todayLabel } from "./common";
import { maskFreeText } from "./mask";
import type { MaterialSender } from "./material";

const RESULT_LABEL: Record<string, string> = { DEAL: "商談化", REPLIED_OK: "前向きな返信", REPLIED_NG: "不成立", NO_REPLY: "未返信", REJECTED: "拒否" };

export async function buildSalesPhrasesMaterial(sender: MaterialSender | null): Promise<string> {
  const asOf = todayLabel();
  const [wins, closings, hearings] = await Promise.all([
    db.salesApproach.findMany({
      where: { result: { in: ["DEAL", "REPLIED_OK"] }, learnings: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { industry: true, method: true, result: true, learnings: true },
    }),
    db.deal.findMany({
      where: { status: "CLOSED_WON", closingFactor: { not: null } },
      orderBy: { closedAt: "desc" },
      take: 10,
      select: { closingFactor: true, customer: { select: { industry: true } } },
    }),
    db.hearingSheet.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { primaryChallenge: true, challengeDetail: true, pastEfforts: true, currentChannels: true, targetCustomers: true },
    }),
  ]);

  const winLines = wins
    .map((w) => ({ ind: w.industry.trim(), r: RESULT_LABEL[w.result] ?? w.result, t: maskFreeText(w.learnings, 140) }))
    .filter((x) => x.t.length >= 12)
    .map((x) => `- 【${x.ind || "業種未記入"}／${x.r}】${x.t}`);
  const closeLines = closings
    .map((c) => ({ ind: (c.customer.industry ?? "").trim(), t: maskFreeText(c.closingFactor, 140) }))
    .filter((x) => x.t.length >= 8)
    .map((x) => `- 【${x.ind || "業種未記入"}】${x.t}`);
  const voice = hearings
    .map((h) => ({ c: h.primaryChallenge ?? "", d: maskFreeText(h.challengeDetail || h.pastEfforts, 110) }))
    .filter((x) => x.d.length >= 10)
    .slice(0, 8)
    .map((x) => `- ${x.c ? `【${x.c}】` : ""}「${x.d}」`);
  const channelCount = new Map<string, number>();
  for (const h of hearings) for (const ch of h.currentChannels) channelCount.set(ch, (channelCount.get(ch) ?? 0) + 1);
  const channels = [...channelCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);

  return `# 営業の言い回し集｜AI用の材料　${asOf}版（Ad Arch OS から自動生成）

> 提案メール・フォーム文・商談の返しに使う「言い方」の材料です。お使いのAIに貼っておくと、文面の型がグループで揃います。
> OSの記録からの抜き出しは、社名・個人名・金額を伏せています。「同じ業種で実績があります」までは言ってよく、社名は言いません。

---

## 1. あなたの会社（差出人）　※空欄だけ自分で埋める

${senderBlock(sender)}

---

## 2. 本部の型（固定）

**文面の作法**
- 短くてよい。長い自己紹介より、用件と「提案の機会をいただけないか」を先に
- 問い合わせフォームは字数制限があることが多い。単刀直入・シンプルに
- 相手の事業に触れた一文（その業界への理解、地元×全国）を入れる
- 「担当変更・新年度・新店舗・周年」は送り時。相手の変化に触れて送る
- ホテル等の問い合わせフォームは宿泊者向けで営業文が入らない。メールアドレスのある先に切り替える
- 数字は「目安」と添える。再生数だけで語らず、到達人数・完全視聴率を必ず添える

**冒頭の一文の型**
- 「〇〇市で△△をされている御社に、テレビCMを市に絞って出す方法をご案内したくご連絡しました」
- 「〇〇周年とお見受けしまして、記念のPRのお手伝いができればとご連絡しました」（設立年は断言しない）
- 「求人媒体で採用が進まないというお話をよく伺います。動画と配信で応募の入口を増やす方法があります」

**締めの型**
- 「まずは『どの市のお客さまが多いか』だけお聞かせいただければ、その市の目安をお出しします」
- 「30分、オンラインでも訪問でも。ご相談の段階では費用はかかりません」

**反論への返し**
- 「高い」→ 小さく始める組み方（市1つ・1ヶ月・月額固定）を出す。「効いていれば広げる」進め方を添える
- 「効果が分からない」→ 月次レポート（再生数・完全視聴率・エリア内訳）を実物で見せる
- 「ネット広告で足りている」→ 「テレビの大画面で、スキップされずに見られる」違いを一言。併用の提案にする
- 「時期が合わない」→ 送り時（周年・新店舗・採用時期）を聞いて、その時期に合わせた案を置いておく

---

## 3. お客様の悩み（グループのヒアリング記録から・匿名）

- いまの集客手段（多い順）: ${channels.length ? channels.join("、") : "（記録なし）"}
${voice.length ? voice.join("\n") : "- （まだ記録がありません）"}
- 使い方: 相手の業種に合う悩みを1つだけ冒頭に置く。決めつけず「〜というお話をよく伺います」の形にする

---

## 4. 反応が出た文面の学び（グループの営業記録から・匿名）

${winLines.length ? winLines.join("\n") : "- （まだ記録がありません）"}

---

## 5. 受注の決め手（グループの受注商談から・匿名）

${closeLines.length ? closeLines.join("\n") : "- （まだ記録がありません）"}

---

## 6. 言ってよいこと・言ってはいけないこと

${commonGuidelines()}

---

## 7. 指示文（この中から1つ選んで送る。＜＞を埋める）

**A. 冒頭の一文を5案**
「上の材料で、＜業種＞の＜会社名＞（＜市＞）宛の提案メールの冒頭の一文を5案。相手の事業に触れ、送り時（周年・採用・新店舗など）があれば使う。社名は{会社名}で。」

**B. 反論への返し**
「上の材料で、＜反論の内容＞と言われたときの返しを3通り、各3行以内で。数字は目安と添える。」

**C. 文面の添削**
「次の営業文を、上の材料の作法に合わせて直して。短く、用件を先に、相手の事業に触れる一文を入れる。禁止事項に触れる箇所は削る。
＜文面を貼る＞」

---

## 8. この材料について
- 出どころ: Ad Arch OS のアプローチ事例（反応あり・商談化）、受注商談の決め手、ヒアリング記録。${asOf}時点の自動抽出・匿名化
- 更新: OSの「ブランドキット」を開くたびに最新。記録が増えるほど濃くなる`;
}
