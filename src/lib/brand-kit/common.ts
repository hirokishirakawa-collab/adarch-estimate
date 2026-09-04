// ==============================================================
// ブランドキット — AI用材料の共通部品（言ってよい・いけない／指示文／出力の線引き）
//   パッケージ・媒体の材料を「開いた瞬間にOSのデータから組み立てる」ための土台。
//   ここに書くのは、どのメニューにも共通で、人が決めた文言だけ。
// ==============================================================

/** 材料に載せない語（仕入れ・原価・マージン等）。台帳の自由記述に紛れていても行ごと落とす */
const BANNED_LINE_PATTERNS = [/卸/, /原価/, /仕入/, /マージン/, /粗利/, /×3/, /x3/i];

/** 自由記述から、外に出してはいけない行を落とす（安全側の網） */
export function stripSensitiveLines(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .filter((line) => !BANNED_LINE_PATTERNS.some((re) => re.test(line)))
    .join("\n")
    .trim();
}

/** 共通の「言ってよい・言ってはいけない」（2026-09-03 本部決定を踏襲） */
export function commonGuidelines(): string {
  return `**言ってよい**
- 語調は「丁寧・提案型・押し売りしない」（本部ガイドライン）
- 数字はすべて「目安」「推計」と添える。到達人数・割合・再生数は保証しない
- 「配信の設定と毎月のレポートは当社（Ad Archグループ）が行います」
- 「同じ用途でグループに実績があります」（社名・金額は言わない）

**言ってはいけない（書かれていたら削る）**
- 「必ず」「効果保証」「○○人にリーチします」と断言する表現
- 仕入れ値・原価・マージン・「業界最安」「他社より安い」
- 単価・価格の値引き（価格は本部規定。変えない）／割引の約束（本部確認）
- 他のお客様の社名・金額／競合他社名／他社の制作実績・事例
- クライアント名の使用（公開実績にある社名でも営業文には書かない）
- Ad Arch本部の名義で書く・本部を騙る表現（差出人は「1. あなたの会社」。「Ad Archグループの〇〇」はよい）
- 虚偽の表現・裏付けのない数字`;
}

/** 共通の指示文。＜＞は各代表が埋める */
export function commonPrompts(opts: { feedbackUrl: string; hasAreaTable: boolean }): string {
  const numbersNote = opts.hasAreaTable
    ? "数字は「3. エリア別の目安」の＜市＞の行から使い、『目安』と添える。"
    : "数字は「2. メニューの事実」の価格だけを使い、『税抜』と添える。";
  return `**A. 提案メール（フォーム営業・メール用、本文300〜450字）**
「上の材料で、＜会社名＞（＜業種＞・＜市＞）宛の提案メールを書いてください。差出人は1の会社。件名1本＋本文。${numbersNote} 「グループの実データ」から相手の業種に合う一文を1つまで入れてよい（社名は出さない）。「言ってはいけない」を守る。最後に公開ページのURLを1本置く。」

**B. 問い合わせフォーム用の短文（250字以内）**
「上の材料で、＜業種＞の会社の問い合わせフォームに貼る250字以内の文を書いてください。会社名の差し込み位置は{会社名}。数字は1つだけ。URLを1本。」

**C. チラシ・LPの見出しとリード文（5案）**
「上の材料で、＜市＞の＜業種＞向けに、見出し（15字以内）＋リード文（40字以内）を5案。保証表現は使わない。」

**D. 反論への返し**
「上の材料で、＜反論の内容（例: 高い／効果が分からない／ネット広告で足りている）＞と言われたときの返しを3通り、各3行以内で書いてください。」

**E. 商談後のお礼と次の一歩（8〜12行）**
「上の材料で、＜会社名＞との商談（＜話した内容を1〜2行＞）のお礼メールを書いてください。次の一歩は具体的なプランと開始時期の確認。数字は目安と添える。」

**F. フィードバック（本部へ送る3行）**
「ここまでで作った文面と、私が入れた修正・お客様の反応を踏まえて、本部へのフィードバックを3行にまとめてください。1行目=何に使ったか、2行目=そのまま使えたか・直した点、3行目=欲しいデータや困った点。」
→ 出てきた3行を、こちらに貼ってください: ${opts.feedbackUrl}`;
}

/** 差出人ブロック（OSの加盟会社データから自動で埋める。無い項目だけ＜＞で残す） */
export function senderBlock(sender: {
  company: string | null;
  person: string | null;
  prefecture: string | null;
  website: string | null;
  email: string | null;
} | null): string {
  const v = (x: string | null | undefined) => (x && x.trim() ? x.trim() : "＜　　　　　＞");
  return `- 会社名: ${v(sender?.company)}
- 代表者: ${v(sender?.person)}
- 所在地（都道府県）: ${v(sender?.prefecture)}
- メール: ${v(sender?.email)}
- サイト: ${v(sender?.website)}
- 主な商圏（市）: ＜例: 宇治市・京都市伏見区＞
- 得意な業種・これまでの制作: ＜1〜2行＞`;
}

export const fmtYen = (v: number) => `¥${Math.round(v).toLocaleString("ja-JP")}`;
export const fmtMan = (v: number) => `${(v / 10_000).toFixed(1)}万`;
export const fmtInt = (v: number) => Math.round(v).toLocaleString("ja-JP");
export const todayLabel = () => new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
