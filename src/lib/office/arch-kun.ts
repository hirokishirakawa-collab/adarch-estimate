// ==============================================================
// アーチくん＝みんなのチャットの仲間（2026-09-01 代表指示）
//   「誰もいない時に質問が来たら、アーチくんが返す」
//   ・返す条件: (他に誰も在席していない ∧ 質問らしい) または アーチくん宛て
//   ・OSの使い方は Wiki を引いて答える。分からないことは分からないと言う
//   ・金額は書かない。人のふりはしない（AIであることは隠さない）
// ==============================================================

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { searchWikiArticles, formatArticlesForPrompt } from "@/lib/wiki-search";
import { ONLINE_WINDOW_MS, DEMO_EMAIL } from "./presence";

export const BOT_EMAIL = "arch-kun@adarch.co.jp";
export const BOT_AVATAR_ID = "arch"; // → /office/avatars/arch-kun.svg

/** アーチくんのユーザー行（無ければ作る）。beat しないので在席には出ない */
export async function ensureBotUser(): Promise<{ id: string }> {
  return db.user.upsert({
    where: { email: BOT_EMAIL },
    update: {},
    create: { email: BOT_EMAIL, name: "アーチくん", role: "USER", officeAvatar: BOT_AVATAR_ID, isActive: true },
    select: { id: true },
  });
}

const MENTION = /アーチ(くん|君)?|@arch/i;
const QUESTIONISH = /[?？]|教えて|どう(すれば|したら|やって|思)|ますか|ですか|でしょうか|かな[？?]?$|ありますか|知ってる|わかる|分かる|方法|やり方/;

export function isMention(text: string): boolean {
  return MENTION.test(text);
}
export function isQuestionish(text: string): boolean {
  return QUESTIONISH.test(text);
}

/** 投稿者以外に、いま誰か在席しているか */
export async function othersOnline(exceptUserId: string): Promise<number> {
  return db.user.count({
    where: {
      id: { not: exceptUserId },
      isActive: true,
      lastSeenAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) },
      email: { notIn: [DEMO_EMAIL, BOT_EMAIL] },
    },
  });
}

const SYSTEM = `あなたは「アーチくん」。広告代理店グループ「アドアーチ」の業務システム Ad-Arch Group OS に住んでいるAIで、
全国の加盟代表（みんな社長）が集まる「みんなのチャット」の仲間の一人です。

## ふるまい
- 丁寧語。短く（2〜5文・200文字以内が目安）。チャットなので見出しや箇条書きは使わない
- 相手は経営者。前置きや過剰な励ましは要らない。聞かれたことに真っ直ぐ答える
- OSの使い方は、渡された社内Wikiの内容に基づいて答え、画面のパス（例: /dashboard/leads）を1つ添える
- 分からないことは正直に「分かりません」と言い、本部（白川代表）に聞く・該当画面を見るなど次の一手を1つ示す
- 金額・単価・売上の数字は書かない（このチャットは金額を書かない場所）
- 自分がAIであることは隠さない。ただし毎回名乗らない
- 質問でない投稿（近況など）に反応する場合は、一言だけ。長く語らない
- 相手の名前は「〜さん」

## このチャット自体の使い方（聞かれたら答える）
- 投稿には絵文字リアクション（👍❤️🔥👏😂🙏）を押せる。投稿の右に出る顔マークから選ぶ。もう一度押すと外れる。押した人の名前はチップにカーソルを合わせると見える。通知は飛ばない
- 📎で商談・顧客・案件・パッケージを紐づけて聞くと、答えがその案件のページに履歴として残る
- 地図やチャットの顔を押すと、その人に1対1の「ひとこと」を送れる。離席中なら通知ベルに載る
- 顔アイコンは設定画面（/dashboard/settings）で24種から選べる
- 本部だけが投稿を消せる`;

/**
 * 直近の流れを見て返事を作る。失敗時は null（黙る）
 */
export async function composeBotReply(input: {
  text: string;
  askerName: string;
  recent: { name: string; text: string; isBot: boolean }[];
  /** 紐づけられた案件の材料（金額は含まない） */
  refContext?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  let wiki = "";
  try {
    const articles = await searchWikiArticles(input.text, 3, { isAdmin: false });
    wiki = formatArticlesForPrompt(articles);
  } catch {
    /* Wikiが引けなくても答える */
  }

  const context = input.recent
    .slice(-10)
    .map((m) => `${m.isBot ? "アーチくん" : m.name + "さん"}: ${m.text}`)
    .join("\n");

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system: [
        { type: "text", text: SYSTEM },
        ...(wiki ? [{ type: "text" as const, text: `## 社内Wiki（参考）\n${wiki}` }] : []),
      ],
      messages: [
        {
          role: "user",
          content: `## 直近のチャット\n${context || "（なし）"}\n\n${input.refContext ? `## 投稿に紐づけられた案件（OSの記録から）\n${input.refContext}\n\n` : ""}## いま投稿されたもの（${input.askerName}さん）\n${input.text}\n\nこの投稿に、チャットの仲間として返事を1つ書いてください。紐づけられた案件がある場合はその材料を踏まえて具体的に答えてください。返事の本文だけを出力してください。`,
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text ? text.slice(0, 600) : null;
  } catch (e) {
    console.error("[office:arch-kun]", e instanceof Error ? e.message : e);
    return null;
  }
}
