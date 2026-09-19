import { z } from "zod";

export const categories = ["まちの広告", "ひと", "媒体の使い方", "広告を仕事に"] as const;
export const genres = ["代表の素顔", "こんな仕事をしました", "現場のひとこま", "まちの話", "広告の疑問", "つくる工夫", "一緒に働く"] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
  .refine(v => !["assets", "people", "media", "index", "feed", "sitemap", "api"].includes(v), "別のURL名にしてください");
const webUrl = z.string().url().max(2000).refine(v => /^https:\/\//.test(v), "httpsのURLにしてください");
const contentFields = {
  kind: z.enum(["article", "person"]), slug: slugSchema,
  title: text(120), summary: text(240), category: z.enum(categories), genre: z.enum(genres),
  region: text(80), area: z.enum(["全国", "北海道・東北", "関東", "甲信越・北陸", "東海", "関西", "中国・四国", "九州・沖縄"]), company: text(120), authorName: text(80),
  authorSlug: slugSchema.optional(), position: z.string().trim().max(100).optional(),
  occurredOn: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
  blocks: z.array(z.object({type: z.enum(["paragraph", "heading", "quote"]), text: text(6000)}).strict()).min(1).max(80),
  photos: z.array(z.object({assetId: z.string().uuid(), alt: text(200), caption: text(300), credit: text(150)}).strict()).max(12),
  // 内部の根拠と一般公開してよい出典を分離。内部資料はmanifestへ出さない。
  evidence: z.array(z.object({label: text(200), reference: text(2000), note: text(2000)}).strict()).min(1).max(30),
  publicSources: z.array(z.object({label: text(200), url: webUrl}).strict()).max(20),
  aiAssisted: z.boolean(),
};
type PersonCheck = {kind:"article"|"person"; category:string; slug?:string; authorSlug?:string; photos:unknown[]};
const personRules = (requireSlug:boolean) => (v:PersonCheck, ctx:z.RefinementCtx) => {
  if (v.kind === "person" && (v.category !== "ひと" || ((requireSlug || v.slug) && v.authorSlug !== v.slug)))
    ctx.addIssue({code:"custom", message:"人物ページはカテゴリー「ひと」、authorSlugはslugと同じにします"});
  if (v.kind === "person" && !v.photos.length)
    ctx.addIssue({code:"custom", message:"人物ページには本人の写真を1枚以上登録してください"});
};
export const contentSchema = z.object(contentFields).strict().superRefine(personRules(true));
export type JournalContent = z.infer<typeof contentSchema>;
/** 旧画面の既定値（story-8桁）は「URL名なし」として扱い、OSが意味のあるURL名を付ける */
export const isPlaceholderSlug = (slug?:string) => !slug || /^story-[0-9a-f]{8}$/.test(slug);
// 投稿時はURL名を省略できる（OSが地域名と中身から付ける）。保存される原稿は常にslugを持つ。
export const draftContentSchema = z.object({...contentFields, slug: slugSchema.optional()}).strict().superRefine(personRules(false));
export type DraftContent = z.infer<typeof draftContentSchema>;
export const saveSchema = z.object({externalId: text(100), expectedRevision: z.number().int().positive().optional(), content: draftContentSchema}).strict();
export const reviewSchema = z.object({id:z.string().uuid(), revision:z.number().int().positive(), action:z.enum(["approve","return","withdraw"]), factsChecked:z.boolean().optional(), rightsChecked:z.boolean().optional(), personChecked:z.boolean().optional(), note:z.string().max(2000).optional(), slug:slugSchema.optional()}).strict();
export class JournalError extends Error { constructor(message:string, public status=400) {super(message);} }
export const publicPath = (c: Pick<JournalContent,"kind"|"slug">) => `/journal/${c.kind === "person" ? "people/" : ""}${c.slug}/`;
export function publicContent(content: JournalContent) {
  const {evidence: _internal, ...safe} = content;
  void _internal;
  return safe;
}
export const writingGuide = {
  tone:"近所の頼れる人に話すように。です・ます。肩書きより具体的なエピソード。自慢や大げさな成果表現は避ける。『商売』は『ビジネス』『地域への貢献』に。",
  genres, categories,
  process:"本人のメモ・写真・公開可能な過去事例から執筆。不明点を質問し、発言・成果・取材を作らない。本人に原稿を見せてからjournal_save_draft。本人が最終確認したらjournal_submitで公開（数分でadarch.co.jp/journal/に載る）。公開後、本部が表現を整えることがある。",
  evidence:"evidenceには内部根拠、publicSourcesには一般公開してよいリンクのみ。過去事例は実施時期と自社の担当範囲を本文に書く。実施したことと確認できた効果を区別する。",
  photos:"journal_upload_photoで本物の写真を登録。画像ID・説明・撮影者をphotosへ。本人の表情、仕事中、地元の風景が伝わる写真を選ぶ。",
  url:"slug（URL名）は空でよい。空ならOSが地域名と中身から付け、初回の公開で確定する。自分で付けるなら半角小文字とハイフンで『地域のローマ字-中身の英語』を2〜5語（例 seki-tver-cm-shooting）。人物ページは『姓-名』のローマ字（例 shirakawa-hiroki）。日付・意味のない番号・社名の略称は入れない。公開後は変わらない。",
  updates:"同じ記事には同じexternalIdを使う。更新前にjournal_getでrevisionを確認してexpectedRevisionに指定。公開済み記事を直した場合は、もう一度journal_submitするまで旧版が載ったまま。",
};
