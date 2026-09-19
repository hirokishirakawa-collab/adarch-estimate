// ==============================================================
// studio.adarch.co.jp の紹介ページ（静的サイト）を返す
//   置き場所: public/studio/（index.html と、そこから相対パスで読む CSS・画像）
//   Codex の成果物 site/ の中身をそのまま public/studio/ にコピーすれば表示が変わる。
//   studio ドメインの "/" と拡張子つきのパス（/style.css・/images/a.jpg など）が next.config.ts の rewrites でここに来る。
//   ・public/studio の外は読まない（.. や絶対パスは404）
//   ・無いファイルは素の404（OSの404画面＝「ダッシュボードへ戻る」を出さない）
// ==============================================================

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "studio");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const notFound = () => new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(_req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path: parts = [] } = await ctx.params;
  if (parts.some((p) => !p || p === "." || p === ".." || p.includes("\\") || p.startsWith("."))) return notFound();
  const rel = parts.length === 0 ? "index.html" : parts.join("/");
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return notFound();
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return notFound();
  try {
    const s = await stat(file);
    if (!s.isFile()) return notFound();
    const body = await readFile(file);
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=300" } });
  } catch {
    return notFound();
  }
}

export const HEAD = GET;
