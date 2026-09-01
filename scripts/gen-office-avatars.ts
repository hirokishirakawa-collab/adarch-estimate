// ==============================================================
// グループオフィスの顔アイコン（アニメ風・24種）を gpt-image-1 で生成
//   実行: railway run npx tsx scripts/gen-office-avatars.ts   （本番のOPENAI_API_KEYを注入・キーは表示しない）
//   出力: public/office/avatars/a01.webp … a24.webp（256px・背景は薄いクリーム色）
//   既にあるファイルは飛ばす（途中で止まっても続きから）
// ==============================================================

import { writeFileSync, existsSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/office/avatars";
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("OPENAI_API_KEY がありません（railway run で実行してください）");
  process.exit(1);
}

// 男女・年代・雰囲気を散らす（社長どうしのオフィス＝働く大人のバリエーション）
const PEOPLE = [
  "a woman in her 30s, short black bob hair, soft smile",
  "a man in his 40s, short black hair, confident smile, navy jacket",
  "a woman in her 40s, long dark hair tied back, round glasses, warm smile",
  "a man in his 30s, wavy brown hair, light stubble, open collar shirt",
  "a woman in her 20s, medium brown hair, bright cheerful smile",
  "a man in his 50s, gray short hair, kind expression, cardigan",
  "a woman in her 50s, short gray-streaked hair, elegant, pearl earrings",
  "a man in his 20s, black messy hair, energetic grin, hoodie",
  "a woman in her 30s, curly dark hair, thin glasses, calm smile",
  "a man in his 40s, shaved head, friendly smile, black turtleneck",
  "a woman in her 40s, chin-length auburn hair, gentle expression, blouse",
  "a man in his 30s, neat side-parted black hair, square glasses, sweater",
  "a woman in her 20s, long black straight hair, bangs, soft smile, blazer",
  "a man in his 60s, white hair, warm wrinkled smile, suit vest",
  "a woman in her 30s, ponytail, athletic, polo shirt, bright smile",
  "a man in his 40s, medium black hair swept back, light beard, denim shirt",
  "a woman in her 60s, short silver hair, dignified, scarf",
  "a man in his 30s, curly black hair, big friendly smile, apron over shirt",
  "a woman in her 40s, wavy brown hair, red lipstick, confident, jacket",
  "a man in his 50s, salt-and-pepper hair, glasses, thoughtful smile, shirt and tie",
  "a woman in her 20s, short pixie cut dyed ash, playful smile, casual",
  "a man in his 20s, long hair tied in a bun, easygoing smile, t-shirt",
  "a woman in her 50s, bob with light perm, gentle smile, cardigan",
  "a man in his 40s, buzz cut, broad smile, work jacket",
];

function prompt(person: string): string {
  return [
    `Anime-style portrait illustration of ${person}, Japanese.`,
    "Bust shot, facing slightly to the side, looking at the viewer, friendly and approachable.",
    "Clean modern Japanese anime look, soft cel shading, clear line art, expressive eyes, natural skin tone.",
    "Plain flat pale cream background (#F6F1E7), no gradient, no pattern, no shadow on background.",
    "Centered composition with head and shoulders filling about 70% of the frame.",
    "No text, no logo, no watermark, no frame, no border, single character only.",
  ].join(" ");
}

async function gen(i: number): Promise<void> {
  const id = `a${String(i + 1).padStart(2, "0")}`;
  const out = `${OUT}/${id}.webp`;
  if (existsSync(out)) {
    console.log(`skip ${id}`);
    return;
  }
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: prompt(PEOPLE[i]),
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
    }),
  });
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${id}: 画像が返りませんでした`);
  const png = Buffer.from(b64, "base64");
  const webp = await sharp(png).resize(256, 256, { fit: "cover" }).webp({ quality: 84 }).toBuffer();
  writeFileSync(out, webp);
  console.log(`ok ${id} ${(webp.length / 1024).toFixed(0)}KB`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // gpt-image-1 は 5枚/分 の制限 → 1枚ずつ・13秒あけて回す。429 は待って再試行
  for (let i = 0; i < PEOPLE.length; i++) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await gen(i);
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/429|Rate limit/i.test(msg) || attempt === 3) throw e;
        console.log(`wait (rate limit) ${i + 1}`);
        await sleep(30_000);
      }
    }
    await sleep(13_000);
  }
  console.log("done");
})().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
