import { db } from "@/lib/db";

// ==============================================================
// 質問タイプ判定
// ==============================================================

export type QueryIntent = "howto" | "business" | "case_study" | "general";

/**
 * ユーザーの質問文から意図を判定する。
 * 単純なキーワードマッチだが、アーチくんの初期版としては十分。
 */
export function detectQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  // 営業相談系キーワード
  const businessKeywords = [
    "提案", "営業", "アプローチ", "トーク", "声掛け", "声かけ",
    "訴求", "セールス", "獲得", "クロージング", "決め手",
    "returning", "リード", "案件獲得", "問い合わせ", "フォーム営業",
    "メール営業", "dm", "新規開拓",
  ];

  // 事例参照系キーワード
  const caseStudyKeywords = [
    "事例", "成功例", "実績", "どこで", "どの業種", "ケース",
    "過去", "他の人", "みんな", "グループで",
  ];

  // 使い方系キーワード
  const howtoKeywords = [
    "使い方", "操作", "手順", "やり方", "設定", "方法は", "どこから",
    "ボタン", "画面", "ページ", "編集", "登録方法", "追加方法",
    "作成方法", "削除方法", "表示",
  ];

  const hasBusiness = businessKeywords.some((k) => q.includes(k));
  const hasCaseStudy = caseStudyKeywords.some((k) => q.includes(k));
  const hasHowto = howtoKeywords.some((k) => q.includes(k));

  if (hasBusiness && !hasHowto) return "business";
  if (hasCaseStudy && !hasHowto) return "case_study";
  if (hasHowto) return "howto";
  return "general";
}

// ==============================================================
// 内部データ検索
// ==============================================================

export interface InternalSource {
  type: "sales_approach" | "highlight" | "deal" | "customer";
  title: string;
  content: string;
  meta: Record<string, string>;
}

/**
 * 質問文から関連する内部ナレッジ（営業事例・連携事例・受注商談）を検索。
 */
export async function searchInternalKnowledge(
  query: string,
  limit = 8
): Promise<InternalSource[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const results: InternalSource[] = [];

  // --- SalesApproach（成功した営業アプローチ優先） ---
  const approaches = await db.salesApproach.findMany({
    where: {
      OR: [
        ...keywords.map((k) => ({ industry: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ targetDesc: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ messageBody: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ learnings: { contains: k, mode: "insensitive" as const } })),
      ],
    },
    orderBy: [{ result: "asc" }, { createdAt: "desc" }], // DEAL が先頭
    take: 4,
    include: {
      groupCompany: { select: { name: true } },
      author: { select: { name: true } },
    },
  });

  for (const a of approaches) {
    results.push({
      type: "sales_approach",
      title: `【営業アプローチ】${a.industry} / ${a.targetDesc || "—"}`,
      content: `方法: ${a.method}\n結果: ${a.result}\n文面(抜粋): ${a.messageBody.slice(0, 300)}${a.messageBody.length > 300 ? "..." : ""}\n学び: ${a.learnings || "—"}`,
      meta: {
        投稿者: a.author.name || "—",
        所属: a.groupCompany.name,
        投稿日: a.createdAt.toISOString().slice(0, 10),
      },
    });
  }

  // --- CollaborationHighlight（アクティブな連携成功事例） ---
  const highlights = await db.collaborationHighlight.findMany({
    where: {
      isActive: true,
      OR: [
        ...keywords.map((k) => ({ title: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ description: { contains: k, mode: "insensitive" as const } })),
      ],
    },
    take: 3,
    include: {
      members: {
        include: { groupCompany: { select: { name: true } } },
      },
    },
  });

  for (const h of highlights) {
    const memberNames = h.members.map((m) => m.groupCompany.name).join(" × ");
    results.push({
      type: "highlight",
      title: `【グループ連携事例】${h.emoji || ""} ${h.title}`,
      content: h.description,
      meta: {
        参加企業: memberNames || "—",
      },
    });
  }

  // --- Deal CLOSED_WON（受注実績） ---
  // closingFactor（決め手）を優先検索、notesも補助として見る
  const wonDeals = await db.deal.findMany({
    where: {
      status: "CLOSED_WON",
      OR: [
        ...keywords.map((k) => ({ title: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ closingFactor: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ notes: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ customer: { name: { contains: k, mode: "insensitive" as const } } })),
        ...keywords.map((k) => ({ customer: { industry: { contains: k, mode: "insensitive" as const } } })),
      ],
    },
    orderBy: [
      // closingFactor がある受注を優先
      { closingFactor: { sort: "desc", nulls: "last" } },
      { closedAt: "desc" },
    ],
    take: 3,
    include: {
      customer: { select: { name: true, industry: true, prefecture: true } },
    },
  });

  for (const d of wonDeals) {
    const amount = d.amount ? `¥${d.amount.toString()}` : "—";
    const customerInfo = `${d.customer.name} (${d.customer.industry || "—"} / ${d.customer.prefecture || "—"})`;
    const closingFactorText = d.closingFactor
      ? `\n決め手: ${d.closingFactor.slice(0, 200)}`
      : "";
    results.push({
      type: "deal",
      title: `【受注実績】${d.title}`,
      content: `顧客: ${customerInfo}\n金額: ${amount}${closingFactorText}${d.notes ? `\nメモ: ${d.notes.slice(0, 150)}` : ""}`,
      meta: {
        受注日: d.closedAt ? d.closedAt.toISOString().slice(0, 10) : "—",
      },
    });
  }

  return results.slice(0, limit);
}

/**
 * 質問文からキーワードを抽出（2文字以上）
 */
function extractKeywords(query: string): string[] {
  return query
    .replace(/[、。,.?？!！（）()「」\s]+/g, " ")
    .split(" ")
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);
}

// ==============================================================
// プロンプト整形
// ==============================================================

export function formatInternalSourcesForPrompt(sources: InternalSource[]): string {
  if (sources.length === 0) return "";

  const typeLabels: Record<InternalSource["type"], string> = {
    sales_approach: "営業アプローチ事例",
    highlight: "グループ連携成功事例",
    deal: "受注実績",
    customer: "顧客情報",
  };

  const grouped: Record<string, InternalSource[]> = {};
  for (const s of sources) {
    const key = typeLabels[s.type];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  return Object.entries(grouped)
    .map(([label, items]) => {
      return `## ${label}\n\n${items
        .map((s) => {
          const metaStr = Object.entries(s.meta)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" / ");
          return `### ${s.title}\n${s.content}\n_${metaStr}_`;
        })
        .join("\n\n")}`;
    })
    .join("\n\n---\n\n");
}
