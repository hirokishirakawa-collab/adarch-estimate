import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

/**
 * 相手企業のWebサイトを解析し、営業文に挿入する一言を生成する。
 * 例: 「御社の新店舗オープンの情報を拝見し」
 */
export async function generateCompanyInsight(
  pageText: string,
  companyName: string,
  industry: string | null
): Promise<string> {
  // ページテキストが少なすぎる場合はデフォルト
  const trimmed = pageText.substring(0, 2000).trim();
  if (trimmed.length < 50) {
    return `${industry ?? "御社の事業"}について拝見し`;
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `以下は「${companyName}」のWebサイトの内容です。この企業に営業メールを送る際に、「御社の○○を拝見し」という形で使える一言を1つだけ生成してください。

サイト内容:
${trimmed}

ルール:
- 「御社の○○を拝見し」または「○○の情報を拝見し」の形式で出力
- 具体的な事業内容・サービス・最近の取り組み・強みに触れる
- 20〜40文字程度
- この一言だけ出力（説明不要）
- 嘘や推測は入れない。サイトに書いてあることだけ使う`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (text.length > 0 && text.length < 80) {
      return text;
    }
    return `${industry ?? "御社の事業"}について拝見し`;
  } catch (err) {
    console.warn("[site-analyzer] 解析失敗:", err instanceof Error ? err.message : err);
    return `${industry ?? "御社の事業"}について拝見し`;
  }
}
