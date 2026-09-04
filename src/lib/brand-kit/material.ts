// ==============================================================
// ブランドキット — パッケージ1件 → AI用材料（Markdown）
//   台帳の登録内容をそのまま写し、見ている人の拠点（差出人・県）と
//   グループの匿名集計を足す。開いた瞬間に組み立てるので常に最新。
// ==============================================================

import type { SalesPackage } from "@/generated/prisma/client";
import { estimateArea, municipalitiesOf, TVER_AREA_CALCULATOR } from "@/lib/packages/tver-area";
import { CLIENT_OWNER_LABEL, formatPackagePrice, parseDeliverables, parseDocs, parseFulfillment, parseOptions, yen } from "@/lib/packages/types";
import { commonGuidelines, commonPrompts, fmtInt, fmtYen, senderBlock, stripSensitiveLines, todayLabel } from "./common";
import { renderGroupData, type GroupDataSummary } from "./group-data";

export interface MaterialSender {
  company: string | null;
  person: string | null;
  prefecture: string | null;
  website: string | null;
  email: string | null;
}

export interface PackageMaterialInput {
  pkg: SalesPackage;
  sender: MaterialSender | null;
  publicUrl: string; // /p/<slug>?from=<拠点ID>（本部は from なし）
  feedbackUrl: string;
  groupData: GroupDataSummary;
  prohibited?: unknown; // SalesGuideline("prohibited").value
}

function bullets(items: string[]): string {
  return items.map((x) => `- ${x}`).join("\n");
}

function renderProhibited(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return bullets(v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))));
  if (typeof v === "string") return v;
  if (typeof v === "object") return bullets(Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${typeof x === "string" ? x : JSON.stringify(x)}`));
  return String(v);
}

/** 3. エリア別の目安（計算機が tver-area のパッケージだけ。見ている人の県で上位の市区） */
function renderAreaTable(pref: string | null, take = 10): string | null {
  if (!pref) return null;
  const munis = municipalitiesOf(pref);
  if (!munis.length) return null;
  const rows: string[] = [];
  for (const m of munis.slice(0, take)) {
    const e = estimateArea(pref, m.code);
    if (!e) continue;
    const t10 = e.tiers.find((t) => t.monthly === 100_000);
    const t20 = e.tiers.find((t) => t.monthly === 200_000);
    const full = e.tiers.find((t) => t.isFull);
    rows.push(
      `| ${m.name} | ${fmtInt(m.population)}人 | ${t10 ? `${fmtInt(t10.reach)}人（${t10.pctResidents.toFixed(1)}%）` : "—"} | ${t20 ? `${fmtInt(t20.reach)}人（${t20.pctResidents.toFixed(1)}%）` : "—"} | ${full ? `${fmtYen(full.monthly)}／月` : "—"} |`
    );
  }
  if (!rows.length) return null;
  const any = estimateArea(pref, munis[0].code);
  const unit = any ? any.unitPrice : 6.6;
  const freq = any ? any.freq : 4.78;
  return `前提: 15秒CM ¥${unit.toFixed(1)}／再生（税抜）。月に届く人数＝再生数÷${freq}回（1人が月に見る平均回数・グループの配信実績）。**すべて推計の目安。保証値ではない。** 表にない市は公開ページで市を選ぶと出ます。

| 市区（${pref}・人口順） | 住民 | 月額10万で届く人数（住民比） | 月額20万で届く人数（住民比） | 商圏まるごと（3ヶ月で3人に1人） |
|---|---|---|---|---|
${rows.join("\n")}`;
}

export function buildPackageMaterial(input: PackageMaterialInput): string {
  const { pkg, sender, publicUrl, feedbackUrl, groupData } = input;
  const asOf = todayLabel();
  const deliverables = parseDeliverables(pkg.deliverables);
  const options = parseOptions(pkg.options);
  const fulfillment = parseFulfillment(pkg.fulfillment);
  const docs = parseDocs(pkg.docs);
  const hasArea = pkg.calculator === TVER_AREA_CALCULATOR;
  const areaTable = hasArea ? renderAreaTable(sender?.prefecture ?? null) : null;

  const sections: string[] = [];

  sections.push(`# ${pkg.name}｜AI用の材料　${asOf}版${sender?.prefecture ? `・${sender.prefecture}` : "・全国"}（Ad Arch OS から自動生成）

> このファイルを、お使いのAI（Claude / ChatGPT / Gemini）に丸ごと貼ってから、最後の「指示文」のどれかを送ってください。
> 数字と価格の正本は Ad Arch OS のパッケージ公開ページです。この材料はOSを開くたびに最新の内容で組み直されます（古いコピーで数字を出さない）。
> ▶️ 公開ページ（お客様に送れます）: ${publicUrl}`);

  sections.push(`## 1. あなたの会社（差出人）　※空欄だけ自分で埋める

${senderBlock(sender)}`);

  const price = formatPackagePrice(pkg);
  const facts: string[] = [];
  facts.push(`**名前**: ${pkg.name}`);
  if (pkg.tagline) facts.push(`**一言**: ${pkg.tagline}`);
  facts.push(`**カテゴリ**: ${pkg.category}`);
  if (pkg.targetIndustries.length) facts.push(`**向いている業種**: ${pkg.targetIndustries.join("／")}`);
  if (pkg.painPoints) facts.push(`\n**こんな悩みの方に**\n${stripSensitiveLines(pkg.painPoints)}`);
  if (pkg.summary) facts.push(`\n**内容**\n${stripSensitiveLines(pkg.summary)}`);
  if (deliverables.length) {
    facts.push(`\n**お届けするもの**\n| 品目 | 数量 | 内容 |\n|---|---|---|\n${deliverables.map((d) => `| ${d.name} | ${d.qty}${d.unit} | ${d.spec || "—"} |`).join("\n")}`);
  }
  if (pkg.leadTime) facts.push(`\n**納期**: ${pkg.leadTime}`);
  facts.push(`**価格**: ${price}（税抜）${pkg.priceNote ? `。${stripSensitiveLines(pkg.priceNote)}` : ""}`);
  if (options.length) {
    facts.push(`**オプション**: ${options.map((o) => `${o.name}${o.price != null ? `（${yen(o.price)}）` : "（価格は本部確認）"}${o.note ? `＝${o.note}` : ""}`).join("／")}`);
  }
  if (fulfillment.length) {
    facts.push(`\n**進め方（お客様に見せる流れ）**\n${fulfillment.map((f, i) => `${i + 1}. ${f.task} → ${CLIENT_OWNER_LABEL[f.owner]}${f.note ? `（${f.note}）` : ""}`).join("\n")}`);
  }
  if (docs.length) facts.push(`\n**資料**: ${docs.map((d) => `${d.title} ${d.url}`).join("／")}`);
  sections.push(`## 2. メニューの事実（OSの登録内容そのまま）\n\n${facts.join("\n")}`);

  if (hasArea) {
    sections.push(
      `## 3. エリア別の目安（${asOf} OSの計算・15秒）　※あなたの県の表\n\n${areaTable ?? "（拠点の都道府県が未登録のため表を出せません。本部にお知らせください。公開ページで市を選ぶと目安が出ます）"}`
    );
  } else {
    sections.push(`## 3. エリア別の目安\n\nこのメニューには計算機がありません。数字は「2. メニューの事実」の価格だけを使ってください。`);
  }

  const rules = stripSensitiveLines(pkg.rules);
  const prohibited = renderProhibited(input.prohibited);
  sections.push(
    `## 4. 言ってよいこと・言ってはいけないこと\n\n${commonGuidelines()}${rules ? `\n\n**このメニューの統一規定（OSの登録内容そのまま）**\n${rules}` : ""}${prohibited ? `\n\n**本部ガイドライン（禁止事項）**\n${prohibited}` : ""}`
  );

  const pitch = stripSensitiveLines(pkg.pitchText).replace(/\{name\}/g, "{会社名}");
  const talk = stripSensitiveLines(pkg.talkTrack);
  const cases = stripSensitiveLines(pkg.caseStudies);
  const sales: string[] = [];
  if (pitch) sales.push(`**提案の基本文**\n${pitch}`);
  if (talk) sales.push(`**切り口**\n${talk}`);
  if (cases) sales.push(`**成功事例（社名・金額は出さない）**\n${cases}`);
  sections.push(`## 5. 営業の型（OSの登録内容そのまま）\n\n${sales.length ? sales.join("\n\n") : "（このメニューの営業文はまだ登録されていません。2の事実だけで組んでください）"}`);

  sections.push(`## 6. 指示文（この中から1つ選んで送る。＜＞を埋める）\n\n${commonPrompts({ feedbackUrl, hasAreaTable: !!areaTable })}`);

  sections.push(`## 7. グループの実データ（匿名集計）\n\n${renderGroupData(groupData, asOf)}`);

  sections.push(`## 8. この材料について
- 出どころ: Ad Arch OS「パッケージ」台帳・アプローチ事例・商談・ヒアリングの記録。${asOf}時点のOSから自動生成
- 更新: OSの「ブランドキット」を開くたびに最新。古いコピーの数字は使わない
- 感想・困った点: ${feedbackUrl}（1分・指示文Fの3行を貼るだけ）
- 困ったら: OSの「みんなのチャット」で📎このパッケージを付けて聞く`);

  return sections.join("\n\n---\n\n");
}
