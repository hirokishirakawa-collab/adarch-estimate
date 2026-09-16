// ==============================================================
// 週次共有で「他拠点の受注例・実績を出してほしい」が選ばれたとき、
// OS がその場で受注例を返す（2026-09-16 代表決定）。
//   ・本部の手作業をゼロにする。本部への依頼アラートは今まで通り飛ぶ
//   ・届け先は OS の中だけ（ベル）。Chat スペース・メールには出さない
//   ・金額は一切出さない（他拠点の金額は出さない線引き。決め手の文だけを渡す）
// ==============================================================

import { db } from "@/lib/db";
import { stripSensitiveLines } from "@/lib/brand-kit/common";
import { ARCHIVE_BRANCH_ID } from "@/lib/data/customers";

/** 渡す受注例の件数 */
const CASE_LIMIT = 5;

/** 金額らしい表記を伏せる（他拠点の金額は出さない） */
function maskAmounts(text: string): string {
  return text
    .replace(/[¥￥]\s?\d[\d,]*(?:\.\d+)?\s*(?:万|万円|円)?/g, "（金額）")
    .replace(/\d[\d,]*(?:\.\d+)?\s*(?:万円|万|円)/g, "（金額）");
}

const clean = (s: string | null | undefined, max: number) => {
  const t = maskAmounts(stripSensitiveLines(s ?? "")).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

const jpDay = (d: Date | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).format(d)
    : "";

/** 決め手として使えない自動取り込みの文（例:「依頼ルート: 不明 ／ Drive実績」） */
const JUNK_FACTOR = /依頼ルート|Drive実績|メール以外の記録/;

/** 取り込み時に付く印を落とす */
const dropMark = (s: string) => s.replace(/^\[AI記録\]\s*/, "");

/**
 * グループの受注例を集めて、そのまま読める文にする。
 * 決め手が残っている受注を優先し、足りなければ決め手なしの受注で「何が売れたか」を埋める。
 */
export async function buildCasesDigest(): Promise<{ text: string; count: number; withFactor: number }> {
  const rows = await db.deal.findMany({
    where: { status: "CLOSED_WON", NOT: { branchId: ARCHIVE_BRANCH_ID } },
    orderBy: { closedAt: "desc" },
    take: 60,
    select: {
      title: true,
      closingFactor: true,
      closedAt: true,
      customer: { select: { industry: true, prefecture: true } },
      branch: { select: { name: true } },
    },
  });

  const shaped = rows.map((d) => {
    const raw = dropMark(d.closingFactor ?? "");
    const factor = JUNK_FACTOR.test(raw) ? "" : clean(raw, 220);
    return {
      factor: factor.length >= 12 ? factor : "",
      head: [d.customer.prefecture, d.customer.industry].filter(Boolean).join("・"),
      when: jpDay(d.closedAt),
      branch: d.branch.name,
      title: clean(d.title, 60) || "案件名なし",
    };
  });

  const picked = [...shaped.filter((r) => r.factor), ...shaped.filter((r) => !r.factor)].slice(0, CASE_LIMIT);
  if (picked.length === 0) return { text: "", count: 0, withFactor: 0 };
  const withFactor = picked.filter((r) => r.factor).length;

  const lines = picked.map((r) =>
    [
      `▶️ ${r.head || "業種未記入"}${r.when ? `（${r.when}・${r.branch}）` : ` / ${r.branch}`}`,
      `　　${r.title}`,
      r.factor ? `　　決め手: ${r.factor}` : "　　決め手: 未記入（何が売れたかの参考に）",
    ].join("\n")
  );

  const text = [
    `グループの受注例を${picked.length}件お持ちしました。金額は伏せています。`,
    "",
    ...lines,
    "",
    "業種や県を絞って引きたいときは、AI連携（アーチくん）に「◯◯業の勝ち筋」と話しかけると、決め手と実際に返信が来た文面がその場で出ます。",
  ].join("\n");

  return { text, count: picked.length, withFactor };
}

/**
 * 「他拠点の受注例」の依頼に、OS がその場で返す。
 * 失敗しても週次共有の保存は止めない（呼び出し側で catch 済み）。
 */
export async function autoAnswerCases(company: { id: string; name: string }, weekId: string) {
  const { text, count } = await buildCasesDigest();
  if (count === 0) return { count: 0 };

  // ベルだけに出す。createInAppNotification は本人設定で Chat・メールへ転送されるので使わない
  const users = await db.user.findMany({
    where: { groupCompanyId: company.id, isActive: true },
    select: { id: true },
  });
  if (users.length > 0) {
    await db.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: "GROUP_REPLY" as const,
        title: "他拠点の受注例をお持ちしました",
        message: text,
        linkUrl: "/dashboard",
      })),
    });
  }

  await db.contactHistory.create({
    data: {
      groupCompanyId: company.id,
      type: "FOLLOW_UP",
      content: `[自動] 他拠点の受注例 ${count}件をOSからお渡ししました（金額なし）`,
      actorName: "アーチくん",
      weekId,
    },
  });

  return { count };
}
