// ==============================================================
// ブランドキット — 切り口ファインダー（AI用材料）
//   周年・補助金・入札・広告賞の「言い方」＋ 見ている人の県のいまの候補。
//   補助金・入札はDB、広告賞は curated.ts、周年はファインダーの使い方だけ。
// ==============================================================

import { db } from "@/lib/db";
import { AD_AWARDS } from "@/lib/ad-award/curated";
import { entryWindow } from "@/lib/ad-award/calc";
import { commonGuidelines, senderBlock, todayLabel } from "./common";
import type { MaterialSender } from "./material";

const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) : "—");

export async function buildFinderMaterial(sender: MaterialSender | null, root: string): Promise<string> {
  const asOf = todayLabel();
  const pref = sender?.prefecture ?? null;
  const now = new Date();

  const [subsidies, tenders] = await Promise.all([
    db.subsidy.findMany({
      where: {
        acceptanceEnd: { gte: now },
        ...(pref ? { OR: [{ targetAreas: { has: pref } }, { targetAreas: { has: "全国" } }] } : {}),
      },
      orderBy: { acceptanceEnd: "asc" },
      take: 6,
      select: { title: true, institutionName: true, acceptanceEnd: true, subsidyRate: true, industry: true },
    }),
    db.tender.findMany({
      where: pref ? { prefectureName: pref } : {},
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { projectName: true, organizationName: true, category: true, procedureType: true },
    }),
  ]);

  const awards = AD_AWARDS.filter((a) => a.scope === "NATIONAL" || (pref && a.prefectures.some((p) => p === pref)))
    .map((a) => ({ a, w: entryWindow(a, now) }))
    .filter((x) => x.w.status === "OPEN" || x.w.status === "UPCOMING")
    .sort((x, y) => x.w.sortKey - y.w.sortKey)
    .slice(0, 6);

  return `# 切り口ファインダー｜AI用の材料　${asOf}版${pref ? `・${pref}` : "・全国"}（Ad Arch OS から自動生成）

> 「広告の予算がない」相手に、財源や送り時のほうから話を持っていくための材料です。周年・補助金・入札・広告賞の4つ。
> 候補の一覧はOSのファインダーが正本です（下は${pref ? `${pref}の` : ""}直近の候補だけ）。

---

## 1. あなたの会社（差出人）　※空欄だけ自分で埋める

${senderBlock(sender)}

---

## 2. 4つの切り口と言い方

**① 周年（記念の広告）**
- 見つけ方: OSの周年ファインダー（${root}/dashboard/anniversary-finder）で、5年刻みの周年を迎える会社を県ごとに出す
- 言い方: 「〇〇周年とお見受けしまして」。設立年は各社サイトから読んだ値で登記情報ではないので**断言しない**
- 提案: 周年の記念動画・周年キャンペーン（TVer配信）・周年の社史や採用動画。周年は決裁が通りやすい

**② 補助金（広告費の財源）**
- 見つけ方: OSの補助金ファインダー（${root}/dashboard/subsidy-finder）で、相手の県・業種・従業員数に合う補助金を出す
- 言い方: 「広告費の一部が補助の対象になる可能性があります。申請の可否は制度側の判断ですので、まず要件をご一緒に確認しませんか」
- 注意: **採択を約束しない**。金額・率は制度ページの記載どおりに。申請の代行はしない（案内まで）

**③ 入札（自治体・官公庁の案件）**
- 見つけ方: OSの入札ファインダー（${root}/dashboard/tender-finder）で、県内の動画・広告・イベントの公告を見る
- 言い方: 「御社が入札に参加される案件の、映像・広告部分を一緒に組めます」。参加資格（A〜D）は相手側の登録が要る
- 注意: 公告の内容・締切は原文で確認。本部と相談してから動く

**④ 広告賞（会話のきっかけ）**
- 見つけ方: OSの広告賞ファインダー（${root}/dashboard/award-finder）で、県と制作物の種類から探す
- 言い方: 「せっかくなので〇〇賞に出しませんか」。制作前・制作中・完了後のどの段階でも使える。地元の賞は応募料が無料〜数千円のものが多い
- 注意: 受賞を約束しない。応募料・締切は公式ページで確認

---

## 3. いまの候補（${pref ?? "全国"}・${asOf}時点）

**補助金（受付中・締切が近い順）**
${subsidies.length ? subsidies.map((s) => `- ${s.title}（${s.institutionName ?? "—"}／締切 ${fmtDate(s.acceptanceEnd)}${s.subsidyRate ? `／補助率 ${s.subsidyRate}` : ""}）`).join("\n") : "- （該当なし。ファインダーで条件を変えて探す）"}

**入札（最近の公告）**
${tenders.length ? tenders.map((t) => `- ${t.projectName}（${t.organizationName ?? "—"}／${t.category ?? "—"}／${t.procedureType ?? "—"}）`).join("\n") : "- （該当なし）"}

**広告賞（応募中・受付予定）**
${awards.length ? awards.map(({ a, w }) => `- ${a.name}（${a.scope === "NATIONAL" ? "全国" : a.region ?? "地方"}／${w.label}${a.feeRaw ? `／${a.feeRaw}` : ""}）`).join("\n") : "- （該当なし）"}

---

## 4. 言ってよいこと・言ってはいけないこと

${commonGuidelines()}

**この材料の注意**
- 採択・受賞・落札を約束しない。「可能性があります」「対象になりえます」まで
- 設立年・周年は断言しない（「〇〇周年とお見受けしまして」）
- 制度の金額・率・締切は原文で確認してから書く

---

## 5. 指示文（この中から1つ選んで送る。＜＞を埋める）

**A. 切り口つきの提案メール**
「上の材料で、＜業種＞の＜会社名＞（＜市＞）宛に、＜周年／補助金／入札／広告賞＞を切り口にした提案メールを300〜450字で。約束表現は使わず、次の一歩は『30分の確認』にする。」

**B. 財源から入る一文**
「上の材料で、『広告の予算がない』と言われた相手に、補助金を切り口に返す一文を3案。採択は約束しない。」

**C. 周年の声かけ**
「上の材料で、＜会社名＞が＜年数＞周年とお見受けする場合の声かけメールを8行以内で。設立年は断言しない。」

---

## 6. この材料について
- 出どころ: Ad Arch OS の周年・補助金・入札・広告賞ファインダー（補助金＝jGrants、入札＝官公需ポータル、広告賞＝本部の一覧）。${asOf}時点
- 更新: OSの「ブランドキット」を開くたびに最新`;
}
