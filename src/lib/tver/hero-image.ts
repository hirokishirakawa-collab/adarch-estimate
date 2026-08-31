// TVerチラシ 上部ビジュアル（ヒーロー画像）— プロンプト下書き／OpenAI gpt-image-1 生成／保存前の正規化。サーバー専用
//   ・数字と文字は絵に入れない（チラシの数値はHTML側で正確に出す。画像内の文字は崩れるため）
//   ・生成は横長 1536x1024。保存は sharp で幅1600px・JPEG に揃える（DBもPDFも重くしない）
//   ・OPENAI_API_KEY が無い環境では generate は使えない（アップロードだけで運用できる）
import sharp from "sharp";

export const HERO_MAX_WIDTH = 1600;
export const HERO_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** 業種 → 描く情景（写真風・日本の生活感・人物は自然に）。無い業種は汎用 */
const SCENES: [RegExp, string][] = [
  [/リフォーム|建設|工務店|住宅/, "a Japanese family relaxing in a freshly renovated bright living room with warm wood and a large window, a craftsman's touch visible in the interior"],
  [/不動産/, "a young Japanese couple looking happily at a new home from the front garden in soft morning light"],
  [/自動車|整備|カーディーラー|車/, "a Japanese family beside a clean car at a friendly local dealership, mechanic in the background, warm afternoon light"],
  [/医療|クリニック|歯科|病院/, "a calm bright Japanese clinic waiting room with a friendly staff member and a relaxed mother and child"],
  [/介護|福祉/, "a gentle Japanese caregiver talking with a smiling elderly person in a sunlit room"],
  [/塾|教育|スクール/, "Japanese junior high school students studying together at a bright tutoring school, a teacher smiling"],
  [/飲食|レストラン|カフェ|居酒屋/, "a cozy Japanese restaurant table with beautifully plated local food and warm lighting, diners softly blurred"],
  [/美容|エステ|サロン|理容/, "a bright modern Japanese beauty salon, a stylist and a relaxed client, soft natural light"],
  [/小売|専門店|ショップ/, "a welcoming local Japanese specialty shop interior with a friendly owner and a browsing customer"],
  [/士業|保険|税理|行政書士|司法/, "a trustworthy Japanese consultant in a bright office explaining to a couple at a table, warm and reassuring"],
  [/採用|求人/, "a diverse team of Japanese employees smiling in a bright workplace, a sense of a good place to work"],
];

export function heroSceneFor(industry: string | null | undefined): string {
  if (industry) for (const [re, scene] of SCENES) if (re.test(industry)) return scene;
  return "a Japanese family relaxing together on a sofa in the evening, watching TV in a warm living room, soft lamp light";
}

/** 本部パネルに入れる既定のプロンプト（英語＝画像モデルの指示精度が高い。本部が日本語で書き換えても可） */
export function buildHeroPrompt(o: { industry: string | null; areaLabel: string; prefName: string }): string {
  return [
    `Warm, natural, editorial lifestyle photograph for a local advertising flyer in ${o.prefName} ${o.areaLabel}, Japan.`,
    `Scene: ${heroSceneFor(o.industry)}.`,
    `Soft golden-hour light, shallow depth of field, gentle warm color grade with subtle orange tones, realistic Japanese people and interiors, calm and friendly mood.`,
    `Wide horizontal composition with quiet space in the upper-left area for a headline overlay.`,
    `Absolutely no text, letters, numbers, logos, signs, watermarks, or captions anywhere in the image. No collage, no borders.`,
  ].join(" ");
}

export interface HeroImage { data: Uint8Array<ArrayBuffer>; type: "image/jpeg" }

/** 受け取った画像（PNG/JPEG/WebP）を幅1600px以内のJPEGに正規化する */
export async function normalizeHeroImage(input: Uint8Array | Buffer): Promise<HeroImage> {
  const out = await sharp(input)
    .rotate()
    .resize({ width: HERO_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  return { data: new Uint8Array(out), type: "image/jpeg" };
}

/** OpenAI gpt-image-1 で横長画像を1枚生成し、正規化して返す */
export async function generateHeroImage(prompt: string): Promise<HeroImage> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY が設定されていません（Railwayの環境変数に追加してください）");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: "1536x1024", quality: "medium", output_format: "jpeg" }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = `OpenAI API error ${res.status}`;
    try { msg = JSON.parse(body)?.error?.message ?? msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("生成結果に画像が含まれていません");
  return normalizeHeroImage(Buffer.from(b64, "base64"));
}

/** HTMLに埋め込む data URL */
export function heroDataUrl(data: Uint8Array | Buffer | null | undefined, type: string | null | undefined): string | null {
  if (!data || data.byteLength === 0) return null;
  return `data:${type || "image/jpeg"};base64,${Buffer.from(data).toString("base64")}`;
}
