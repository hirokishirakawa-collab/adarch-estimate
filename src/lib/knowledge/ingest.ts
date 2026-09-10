// ==============================================================
// 資料ライブラリ — 取り込み（登録 → 全文 → AI整理 → READY）
//   API は登録直後に返し、after() でこの processSource を回す。
//   失敗は FAILED + errorMessage に残し、管理画面から「やり直す」で再実行できる。
// ==============================================================

import { db } from "@/lib/db";
import { readKnowledgeFile } from "@/lib/storage";
import { extractFile, extractUrl, MAX_CONTENT_CHARS } from "./extract";
import { buildDigest } from "./digest";

export async function processSource(id: string): Promise<void> {
  const src = await db.knowledgeSource.findUnique({ where: { id } });
  if (!src) return;
  try {
    await db.knowledgeSource.update({ where: { id }, data: { status: "PENDING", errorMessage: null } });

    // 1) 全文
    let content = src.content;
    let pageCount = src.pageCount;
    let urlTitle: string | null = null;
    if (src.kind === "FILE") {
      if (!src.fileUrl || !src.fileName) throw new Error("ファイルがありません");
      const buf = readKnowledgeFile(src.fileUrl);
      if (!buf) throw new Error("保存したファイルを読めませんでした（ストレージ）");
      const ext = src.fileName.split(".").pop()?.toLowerCase() ?? "";
      const r = await extractFile(buf, ext);
      content = r.content;
      pageCount = r.pageCount;
    } else if (src.kind === "URL") {
      if (!src.sourceUrl) throw new Error("URLがありません");
      const r = await extractUrl(src.sourceUrl);
      content = r.content;
      pageCount = r.pageCount;
      urlTitle = r.title;
    }
    content = content.trim();
    if (!content) throw new Error("本文が空です");
    if (content.length > MAX_CONTENT_CHARS) content = content.slice(0, MAX_CONTENT_CHARS) + "\n\n（以降は長すぎるため省略）";

    // 2) AI整理
    const d = await buildDigest({ content, origin: src.origin, title: src.title, publisher: src.publisher, note: src.note });

    // 3) 保存。題名・発行元は「登録時に入れた値」を優先し、空ならAIの読み取りで埋める
    const isPlaceholderTitle = !src.title || src.title === src.fileName || src.title === src.sourceUrl;
    await db.knowledgeSource.update({
      where: { id },
      data: {
        status: "READY",
        errorMessage: null,
        content,
        pageCount,
        charCount: content.length,
        summary: d.summary,
        digest: d.digest,
        keywords: d.keywords,
        title: isPlaceholderTitle ? d.title ?? urlTitle ?? src.title : src.title,
        publisher: src.publisher ?? d.publisher,
        publishedAt: src.publishedAt ?? d.publishedAt,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[knowledge:ingest]", id, message);
    await db.knowledgeSource.update({ where: { id }, data: { status: "FAILED", errorMessage: message.slice(0, 500) } }).catch(() => {});
  }
}
