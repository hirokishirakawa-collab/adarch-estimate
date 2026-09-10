// ==============================================================
// 資料ライブラリ — 全文の取り出し
//   PDF   : Claude にそのまま読ませて忠実に文字起こし（媒体資料は画像中心のスライドが多く、
//           テキスト抽出では図表・数字が落ちるため）。ページ印「## p.N」つき
//   PPTX  : jszip で slideN.xml の <a:t> を拾う（スライド印「## p.N」つき）
//   DOCX  : jszip で document.xml の段落を拾う
//   URL   : fetch + cheerio で本文テキスト
//   TEXT  : そのまま
// ==============================================================

import Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";
import * as cheerio from "cheerio";

export interface ExtractResult {
  content: string;
  pageCount: number | null;
}

export const KNOWLEDGE_ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
};

/** 拡張子から形式を判定（ブラウザが type を空で送る場合の保険） */
export function detectExt(fileName: string, mime: string): string | null {
  if (KNOWLEDGE_ALLOWED[mime]) return KNOWLEDGE_ALLOWED[mime];
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ["pdf", "pptx", "docx", "txt", "md", "csv"].includes(ext) ? ext : null;
}

export const MAX_FILE_BYTES = 30 * 1024 * 1024; // Claude の PDF 上限（32MB/リクエスト）に合わせる
export const MAX_CONTENT_CHARS = 400_000; // 全文の保存上限（約10万トークン相当）

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

// ---------------- PPTX ----------------
export async function extractPptx(buf: Buffer): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
  const parts: string[] = [];
  for (const f of slideFiles) {
    const n = Number(f.match(/slide(\d+)/)![1]);
    const xml = await zip.file(f)!.async("string");
    // 段落 <a:p> ごとに改行、その中の <a:t> を連結
    const paras = Array.from(xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)).map((m) =>
      Array.from(m[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((t) => decodeXml(t[1])).join("")
    );
    const text = paras.map((p) => p.trim()).filter(Boolean).join("\n");
    // ノート（発表者メモ）も拾う
    const notesFile = `ppt/notesSlides/notesSlide${n}.xml`;
    let notes = "";
    if (zip.file(notesFile)) {
      const nx = await zip.file(notesFile)!.async("string");
      notes = Array.from(nx.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((t) => decodeXml(t[1])).join(" ").trim();
      notes = notes.replace(/^\d+$/, ""); // ページ番号だけのノートは捨てる
    }
    parts.push(`## p.${n}\n${text}${notes ? `\n\n（発表者ノート）${notes}` : ""}`);
  }
  return { content: parts.join("\n\n"), pageCount: slideFiles.length };
}

// ---------------- DOCX ----------------
export async function extractDocx(buf: Buffer): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("document.xml が見つかりません");
  const paras = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)).map((m) => {
    const isHeading = /<w:pStyle w:val="Heading(\d)"/.exec(m[0]);
    const text = Array.from(m[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)).map((t) => decodeXml(t[1])).join("");
    if (!text.trim()) return "";
    return isHeading ? `${"#".repeat(Math.min(3, Number(isHeading[1]) + 1))} ${text.trim()}` : text;
  });
  return { content: paras.filter(Boolean).join("\n"), pageCount: null };
}

// ---------------- URL ----------------
export async function extractUrl(url: string): Promise<ExtractResult & { title: string | null }> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; AdArchOS-Knowledge/1.0)", accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`取得に失敗しました（HTTP ${res.status}）`);
  const ctype = res.headers.get("content-type") ?? "";
  if (ctype.includes("application/pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    const r = await extractPdf(buf);
    return { ...r, title: null };
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
  $("script, style, noscript, nav, header, footer, iframe, svg, form").remove();
  const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");
  const lines: string[] = [];
  root.find("h1, h2, h3, h4, p, li, td, th, dt, dd, blockquote, pre").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t) return;
    if (/^h[1-4]$/.test(tag)) lines.push(`${"#".repeat(Number(tag[1]) + 1)} ${t}`);
    else lines.push(t);
  });
  const content = (lines.length ? lines : [root.text().replace(/\s+/g, " ").trim()]).join("\n");
  return { content, pageCount: null, title };
}

// ---------------- PDF（Claude 直読み） ----------------
const PDF_SYSTEM = `あなたは資料の文字起こし係です。渡されたPDFの内容を、ページ順に、省略せず忠実にMarkdownに書き起こしてください。
- 各ページの先頭に「## p.N」（Nはページ番号・1始まり）を置く
- 見出しは ###、本文はそのまま、表は Markdown の表にする（列の数字は一つも落とさない）
- 図・グラフ・地図・写真は「（図: …）」として、読み取れる数字・ラベル・凡例を全部書く
- 価格表・料金表・スペック表・配信面・エリア・条件・注記（※）は最優先で漏らさない
- 装飾・ページ番号だけの行は省く。要約や感想は書かない。本文以外の文章（前置き・後書き）は出力しない`;

export async function extractPdf(buf: Buffer): Promise<ExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定です");
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 64000,
    system: PDF_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } },
          { type: "text", text: "このPDFを上記の決まりで書き起こしてください。" },
        ],
      },
    ],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("AIが読み取りを拒否しました");
  const text = msg.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new Error("PDFから文字を取り出せませんでした");
  const pages = text.match(/^## p\.\d+/gm)?.length ?? null;
  return { content: text, pageCount: pages };
}

// ---------------- 入口 ----------------
export async function extractFile(buf: Buffer, ext: string): Promise<ExtractResult> {
  switch (ext) {
    case "pdf":
      return extractPdf(buf);
    case "pptx":
      return extractPptx(buf);
    case "docx":
      return extractDocx(buf);
    case "txt":
    case "md":
    case "csv":
      return { content: buf.toString("utf8"), pageCount: null };
    default:
      throw new Error(`対応していない形式です: ${ext}`);
  }
}
