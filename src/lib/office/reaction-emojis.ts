// ==============================================================
// みんなのチャットの絵文字リアクション（固定セット）
//   ⚠️ このファイルはブラウザ側の部品からも読む＝DB(Prisma)を import しない
//   増やす/減らすときはここだけ
// ==============================================================

export const REACTION_EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🙏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(v: unknown): v is ReactionEmoji {
  return typeof v === "string" && (REACTION_EMOJIS as readonly string[]).includes(v);
}
