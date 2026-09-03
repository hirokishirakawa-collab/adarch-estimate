// ==============================================================
// みんなのチャットの絵文字リアクション（サーバー側の集計）
//   ・固定セットは reaction-emojis.ts（ブラウザ側と共有・DBを読まない）
//   ・一覧取得で「投稿ID → リアクション集計」を作る（数・自分が押したか・押した人）
//   ⚠️ このファイルは db を読む＝クライアント部品から import しない（Turbopackで pg がブラウザに混ざり本番ビルドが落ちる 2026-09-03）
// ==============================================================

import { db } from "@/lib/db";
import { REACTION_EMOJIS } from "./reaction-emojis";

export { REACTION_EMOJIS, isReactionEmoji, type ReactionEmoji } from "./reaction-emojis";

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
