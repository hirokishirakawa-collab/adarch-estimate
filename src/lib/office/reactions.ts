// ==============================================================
// みんなのチャットの絵文字リアクション（共通）
//   ・固定セット6種（増やすときはここだけ）
//   ・一覧取得で「投稿ID → リアクション集計」を作る（数・自分が押したか・押した人）
// ==============================================================

import { db } from "@/lib/db";

export const REACTION_EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🙏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(v: unknown): v is ReactionEmoji {
  return typeof v === "string" && (REACTION_EMOJIS as readonly string[]).includes(v);
}

export type ReactionView = {
  emoji: string;
  count: number;
  mine: boolean;
  names: string[]; // 押した人（表示名・最大10人）
};

/** 指定した投稿群のリアクションをまとめて集計する（表示順は REACTION_EMOJIS の順） */
export async function reactionsForMessages(messageIds: string[], meId: string): Promise<Record<string, ReactionView[]>> {
  // 聞かれた投稿は全部キーを持つ（空配列も返す＝「外された」も画面に反映できる）
  const out: Record<string, ReactionView[]> = Object.fromEntries(messageIds.map((id) => [id, []]));
  if (messageIds.length === 0) return out;

  const rows = await db.officeChatReaction.findMany({
    where: { messageId: { in: messageIds } },
    select: { messageId: true, emoji: true, userId: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const byMsg = new Map<string, Map<string, { count: number; mine: boolean; names: string[] }>>();
  for (const r of rows) {
    let m = byMsg.get(r.messageId);
    if (!m) byMsg.set(r.messageId, (m = new Map()));
    let e = m.get(r.emoji);
    if (!e) m.set(r.emoji, (e = { count: 0, mine: false, names: [] }));
    e.count += 1;
    if (r.userId === meId) e.mine = true;
    if (e.names.length < 10) e.names.push(r.user.name ?? r.user.email.split("@")[0]);
  }
  for (const [id, m] of byMsg) {
    out[id] = REACTION_EMOJIS.filter((emoji) => m.has(emoji)).map((emoji) => ({ emoji, ...m.get(emoji)! }));
  }
  return out;
}
