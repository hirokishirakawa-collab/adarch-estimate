import { z } from "zod";

export const categories = ["まちの広告", "ひと", "媒体の使い方", "広告を仕事に"] as const;
export const genres = ["代表の素顔", "こんな仕事をしました", "現場のひとこま", "まちの話", "広告の疑問", "つくる工夫", "一緒に働く"] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)
  .refine(v => !["assets", "people", "media", "index", "feed", "sitemap", "api"].includes(v), "別のURL名にしてください");
const webUrl = z.string().url().max(2000).refine(v => /^https:\/\//.test(v), "httpsのURLにしてください");
export const contentSchema = z.object({
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
}).strict().superRefine((v,ctx) => {
  if (v.kind === "person" && (v.category !== "ひと" || v.authorSlug !== v.slug))
    ctx.addIssue({code:"custom", message:"人物ページはカテゴリー「ひと」、authorSlugはslugと同じにします"});
  if (v.kind === "person" && !v.photos.length)
    ctx.addIssue({code:"custom", message:"人物ページには本人の写真を1枚以上登録してください"});
});
export type JournalContent = z.infer<typeof contentSchema>;
export const saveSchema = z.object({externalId: text(100), expectedRevision: z.number().int().positive().optional(), content: contentSchema}).strict();
export const reviewSchema = z.object({id:z.string().uuid(), revision:z.number().int().positive(), action:z.enum(["approve","return","withdraw"]), factsChecked:z.boolean().optional(), rightsChecked:z.boolean().optional(), personChecked:z.boolean().optional(), note:z.string().max(2000).optional()}).strict();
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
  process:"本人のメモ・写真・公開可能な過去事例から執筆。不明点を質問し、発言・成果・取材を作らない。本人に原稿を見せてからjournal_save_draft。確認依頼はjournal_submit。公開操作はOSの本部画面。",
  evidence:"evidenceには内部根拠、publicSourcesには一般公開してよいリンクのみ。過去事例は実施時期と自社の担当範囲を本文に書く。実施したことと確認できた効果を区別する。",
  photos:"journal_upload_photoで本物の写真を登録。画像ID・説明・撮影者をphotosへ。本人の表情、仕事中、地元の風景が伝わる写真を選ぶ。",
  updates:"同じ記事には同じexternalIdを使う。更新前にjournal_getでrevisionを確認してexpectedRevisionに指定。公開済み記事の修正も再確認するまで旧版を維持。",
};
