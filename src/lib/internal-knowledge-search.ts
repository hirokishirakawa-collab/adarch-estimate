import { db } from "@/lib/db";

// ==============================================================
// 質問タイプ判定
// ==============================================================

export type QueryIntent = "howto" | "business" | "case_study" | "general";

export function detectQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  const businessKeywords = [
    "提案", "営業", "アプローチ", "トーク", "声掛け", "声かけ",
    "訴求", "セールス", "獲得", "クロージング", "決め手",
    "リード", "案件獲得", "問い合わせ", "フォーム営業",
    "メール営業", "dm", "新規開拓", "プレゼン",
  ];
  const caseStudyKeywords = [
    "事例", "成功例", "実績", "どこで", "どの業種", "ケース",
    "過去", "他の人", "みんな", "グループで", "他社",
  ];
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
// キーワード展開（同義語・正規化）
// ==============================================================

const SYNONYM_MAP: Record<string, string[]> = {
  // 顧客属性
  toc: ["btoc", "b2c", "小売", "一般消費者", "消費者向け", "個人向け"],
  tob: ["btob", "b2b", "法人", "企業向け", "法人向け"],
  // 営業動作
  提案: ["プレゼン", "提示", "持ち込み", "オファー"],
  営業: ["アプローチ", "セールス", "開拓"],
  獲得: ["受注", "成約", "クロージング", "決定"],
  // 業種
  飲食: ["レストラン", "居酒屋", "カフェ", "フード"],
  小売: ["物販", "店舗", "ショップ", "リテール"],
  不動産: ["物件", "賃貸", "住宅"],
  美容: ["サロン", "エステ", "美容院"],
  // 広告媒体
  動画: ["映像", "ムービー", "video"],
  sns: ["インスタ", "tiktok", "x", "twitter", "ソーシャル"],
  テレビ: ["tvcm", "tver", "cm"],
  タクシー: ["taxi", "go", "タクシーサイネージ"],
  // その他
  業種: ["業界", "カテゴリ"],
  決め手: ["ポイント", "勝因", "要因"],
};

function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>(keywords);
  for (const k of keywords) {
    const kl = k.toLowerCase();
    // 同義語展開
    for (const [base, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (kl === base || synonyms.includes(kl) || kl.includes(base)) {
        expanded.add(base);
        synonyms.forEach((s) => expanded.add(s));
      }
    }
    // カタカナ→ひらがな、ひらがな→カタカナ
    expanded.add(toHiragana(k));
    expanded.add(toKatakana(k));
  }
  return Array.from(expanded).filter((k) => k.length >= 2);
}

function toHiragana(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function toKatakana(s: string): string {
  return s.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

function extractKeywords(query: string): string[] {
  return query
    .replace(/[、。,.?？!！（）()「」\s]+/g, " ")
    .split(" ")
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);
}

// ==============================================================
// 内部データ検索（拡張版）
// ==============================================================

export interface InternalSource {
  type: "sales_approach" | "highlight" | "deal" | "deal_log" | "customer" | "sales_activity" | "proposal";
  title: string;
  content: string;
  meta: Record<string, string>;
  score?: number;
}

export async function searchInternalKnowledge(
  query: string,
  limit = 10
): Promise<InternalSource[]> {
  const baseKeywords = extractKeywords(query);
  if (baseKeywords.length === 0) return [];
  const keywords = expandKeywords(baseKeywords);

  const results: InternalSource[] = [];

  // --- SalesApproach ---
  const approaches = await db.salesApproach.findMany({
    where: {
      OR: [
        ...keywords.map((k) => ({ industry: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ targetDesc: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ messageBody: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ learnings: { contains: k, mode: "insensitive" as const } })),
      ],
    },
    orderBy: [{ result: "asc" }, { createdAt: "desc" }],
    take: 5,
    include: {
      groupCompany: { select: { name: true } },
      author: { select: { name: true } },
    },
  });
  for (const a of approaches) {
    results.push({
      type: "sales_approach",
      title: `【営業アプローチ】${a.industry} / ${a.targetDesc || "—"}`,
      content: `方法: ${a.method}\n結果: ${a.result}\n文面: ${a.messageBody.slice(0, 280)}${a.messageBody.length > 280 ? "..." : ""}\n学び: ${a.learnings || "—"}`,
      meta: {
        投稿者: a.author.name || "—",
        所属: a.groupCompany.name,
        投稿日: a.createdAt.toISOString().slice(0, 10),
      },
    });
  }

  // --- CollaborationHighlight ---
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
      members: { include: { groupCompany: { select: { name: true } } } },
    },
  });
  for (const h of highlights) {
    const memberNames = h.members.map((m) => m.groupCompany.name).join(" × ");
    results.push({
      type: "highlight",
      title: `【連携事例】${h.emoji || ""} ${h.title}`,
      content: h.description,
      meta: { 参加企業: memberNames || "—" },
    });
  }

  // --- Deal（CLOSED_WON 優先、他ステータスも拾う） ---
  const deals = await db.deal.findMany({
    where: {
      OR: [
        ...keywords.map((k) => ({ title: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ closingFactor: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ notes: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ customer: { industry: { contains: k, mode: "insensitive" as const } } })),
        ...keywords.map((k) => ({ customer: { name: { contains: k, mode: "insensitive" as const } } })),
      ],
    },
    orderBy: [
      { status: "asc" }, // CLOSED_WONが先
      { closingFactor: { sort: "desc", nulls: "last" } },
      { closedAt: "desc" },
    ],
    take: 5,
    include: {
      customer: { select: { name: true, industry: true, prefecture: true } },
    },
  });
  for (const d of deals) {
    const amount = d.amount ? `¥${d.amount.toString()}` : "—";
    const customerInfo = `${d.customer.name}（${d.customer.industry || "業種—"} / ${d.customer.prefecture || "—"}）`;
    const statusLabel = d.status === "CLOSED_WON" ? "受注済" : d.status === "CLOSED_LOST" ? "失注" : "進行中";
    const closingText = d.closingFactor ? `\n決め手: ${d.closingFactor.slice(0, 200)}` : "";
    const notesText = d.notes ? `\nメモ: ${d.notes.slice(0, 150)}` : "";
    results.push({
      type: "deal",
      title: `【商談】${d.title}（${statusLabel}）`,
      content: `顧客: ${customerInfo}\n金額: ${amount}${closingText}${notesText}`,
      meta: {
        受注日: d.closedAt ? d.closedAt.toISOString().slice(0, 10) : "—",
      },
    });
  }

  // --- DealLog（商談活動ログ・メモ） ---
  const dealLogs = await db.dealLog.findMany({
    where: {
      OR: keywords.map((k) => ({ content: { contains: k, mode: "insensitive" as const } })),
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      deal: {
        select: {
          title: true,
          customer: { select: { name: true, industry: true } },
        },
      },
    },
  });
  for (const log of dealLogs) {
    results.push({
      type: "deal_log",
      title: `【商談ログ】${log.deal.title}`,
      content: `顧客: ${log.deal.customer.name}（${log.deal.customer.industry || "—"}）\n内容: ${log.content.slice(0, 250)}`,
      meta: {
        記録者: log.staffName,
        日付: log.createdAt.toISOString().slice(0, 10),
      },
    });
  }

  // --- SalesActivity（営業活動記録） ---
  const activities = await db.salesActivity.findMany({
    where: {
      OR: [
        ...keywords.map((k) => ({ companyName: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ note: { contains: k, mode: "insensitive" as const } })),
      ],
    },
    orderBy: { date: "desc" },
    take: 3,
    include: { user: { select: { name: true } } },
  });
  for (const act of activities) {
    if (!act.note) continue;
    results.push({
      type: "sales_activity",
      title: `【営業活動】${act.companyName}`,
      content: `種別: ${act.type}\nメモ: ${act.note.slice(0, 250)}`,
      meta: {
        担当: act.user.name || "—",
        日付: act.date.toISOString().slice(0, 10),
      },
    });
  }

  // --- Proposal（生成済み提案書の業種・課題データ） ---
  const proposals = await db.proposal.findMany({
    where: {
      OR: [
        ...keywords.map((k) => ({ industry: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ challenge: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ companyName: { contains: k, mode: "insensitive" as const } })),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      companyName: true,
      industry: true,
      challenge: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
  for (const p of proposals) {
    results.push({
      type: "proposal",
      title: `【提案書】${p.companyName}（${p.industry}）`,
      content: `課題: ${p.challenge.slice(0, 250)}`,
      meta: {
        作成者: p.user.name || "—",
        作成日: p.createdAt.toISOString().slice(0, 10),
      },
    });
  }

  // --- Customer（業種マッチで拾う参考情報） ---
  const customers = await db.customer.findMany({
    where: {
      OR: [
        ...keywords.map((k) => ({ industry: { contains: k, mode: "insensitive" as const } })),
        ...keywords.map((k) => ({ notes: { contains: k, mode: "insensitive" as const } })),
      ],
      rank: { in: ["A", "B"] }, // ランク高のみ
    },
    take: 3,
    select: {
      name: true,
      industry: true,
      prefecture: true,
      rank: true,
      notes: true,
    },
  });
  for (const c of customers) {
    results.push({
      type: "customer",
      title: `【顧客】${c.name}（${c.industry || "—"}）`,
      content: `地域: ${c.prefecture || "—"} / ランク: ${c.rank || "—"}${c.notes ? `\nメモ: ${c.notes.slice(0, 150)}` : ""}`,
      meta: {},
    });
  }

  return results.slice(0, limit);
}

// ==============================================================
// プロンプト整形
// ==============================================================

export function formatInternalSourcesForPrompt(sources: InternalSource[]): string {
  if (sources.length === 0) return "";

  const typeLabels: Record<InternalSource["type"], string> = {
    sales_approach: "営業アプローチ事例",
    highlight: "グループ連携成功事例",
    deal: "商談・受注実績",
    deal_log: "商談活動ログ",
    sales_activity: "営業活動記録",
    proposal: "過去の提案書（業種・課題）",
    customer: "優良顧客情報",
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
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" / ");
          return `### ${s.title}\n${s.content}${metaStr ? `\n_${metaStr}_` : ""}`;
        })
        .join("\n\n")}`;
    })
    .join("\n\n---\n\n");
}
