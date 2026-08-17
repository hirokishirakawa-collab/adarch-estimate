"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { logAudit } from "@/lib/audit";

/**
 * リード獲得AI（/dashboard/leads）の書き出しを、そのままアウトリーチに取り込む。
 *
 * 書き出しは BOM付きUTF-8 のCSV。Excelで開いて .xlsx で保存し直したものも受ける。
 * 列は日本語のヘッダー名で突き合わせるので、列順が変わっても壊れない。
 *
 * ⚠️ リード獲得AIの書き出しに**メール列はない**（Lead モデルが持っていない）。
 * 取り込んだリードはメールが空のままになるので、画面側で補える導線を用意している。
 */

export type ImportRow = {
  companyName: string;
  email: string | null;
  website: string | null;
  prefecture: string | null;
  businessNote: string | null;
};

export type ParseResult = {
  error?: string;
  rows?: ImportRow[];
  /** 会社名が無くて捨てた行数 */
  dropped?: number;
  /** ファイルから読めた見出し（何が拾えたかを画面で示すため） */
  headers?: string[];
};

const MAX_ROWS = 2000;
const MAX_BYTES = 10 * 1024 * 1024;

/** 見出しのゆらぎを吸収する。左が正、右が受け付ける表記。 */
const HEADER_ALIASES: Record<keyof ImportRow | "contactName" | "phone" | "industry" | "address" | "comment", string[]> = {
  companyName: ["企業名", "会社名", "社名", "法人名", "name", "company"],
  email: ["メール", "メールアドレス", "email", "mail", "e-mail"],
  website: ["webサイト", "website", "url", "ホームページ", "hp", "サイト"],
  prefecture: ["エリア", "都道府県", "地域", "area", "prefecture"],
  businessNote: ["メモ", "備考", "note"],
  // 「担当者」は入れない。リード獲得AIの書き出しでは自社の担当者を指すため、
  // 先方の担当者として取り込むと相手の名前欄に自社の社員名が入ってしまう。
  contactName: ["代表者名", "先方担当者", "ご担当者"],
  phone: ["電話番号", "電話", "tel", "phone"],
  industry: ["業種", "industry"],
  address: ["住所", "address"],
  comment: ["aiコメント", "コメント", "スコアコメント"],
};

function normalizeHeader(h: string): string {
  return h.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, "");
}

/** 見出し行から「項目名 → 列番号」を作る */
function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] !== undefined) continue;
      if (aliases.some((a) => h === normalizeHeader(a))) map[key] = i;
    }
  });
  return map;
}

/** RFC4180 相当のCSVパーサ。引用符・改行入りセル・CRLF・BOMに対応する。 */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** xlsx を読む。exceljs は読み取りのみに使う。 */
async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const vals: string[] = [];
    // eachCell は空セルを飛ばすので、列番号で埋め直す
    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const v = cell.value;
      let s = "";
      if (v == null) s = "";
      else if (typeof v === "object" && "text" in v) s = String(v.text ?? "");        // ハイパーリンク/リッチテキスト
      else if (typeof v === "object" && "result" in v) s = String(v.result ?? "");    // 数式
      else if (v instanceof Date) s = v.toISOString().slice(0, 10);
      else s = String(v);
      vals[colNumber - 1] = s;
    });
    for (let i = 0; i < vals.length; i++) if (vals[i] === undefined) vals[i] = "";
    out.push(vals);
  });
  return out.filter((r) => r.some((v) => v.trim() !== ""));
}

const clean = (v: string | undefined) => {
  const s = (v ?? "").trim();
  return s === "" || s === "-" || s === "—" ? null : s;
};

/** ファイルを読んで、取り込み候補の行に整える（この時点ではDBに書かない） */
export async function parseOutreachImportFile(formData: FormData): Promise<ParseResult> {
  const info = await getSessionInfo();
  if (!info || (info.role !== "ADMIN" && info.role !== "MANAGER")) {
    return { error: "権限がありません" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "ファイルが選択されていません" };
  if (file.size === 0) return { error: "ファイルが空です" };
  if (file.size > MAX_BYTES) return { error: "ファイルが大きすぎます（上限10MB）" };

  let table: string[][];
  try {
    const isXlsx =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.type.includes("spreadsheetml") ||
      file.type === "application/vnd.ms-excel";
    if (isXlsx) {
      table = await parseXlsx(await file.arrayBuffer());
    } else {
      table = parseCsv(new TextDecoder("utf-8").decode(await file.arrayBuffer()));
    }
  } catch (e) {
    console.error("[parseOutreachImportFile]", e instanceof Error ? e.message : e);
    return { error: "ファイルを読み取れませんでした。CSV（UTF-8）か .xlsx で保存し直してください。" };
  }

  if (table.length < 2) return { error: "データ行がありません（1行目が見出し、2行目以降がデータです）" };

  const headers = table[0].map((h) => h.replace(/^﻿/, "").trim());
  const col = mapColumns(headers);
  if (col.companyName === undefined) {
    return { error: `「企業名」の列が見つかりません。読み取れた見出し: ${headers.filter(Boolean).slice(0, 12).join(" / ")}` };
  }

  const at = (r: string[], key: string) => (col[key] === undefined ? null : clean(r[col[key]]));

  const rows: ImportRow[] = [];
  let dropped = 0;
  for (const r of table.slice(1, MAX_ROWS + 1)) {
    const companyName = at(r, "companyName");
    if (!companyName) { dropped++; continue; }

    // 事業メモは、営業文を書くときの材料になるものを1行にまとめる
    const noteParts = [
      at(r, "industry"),
      at(r, "address"),
      at(r, "phone") ? `TEL ${at(r, "phone")}` : null,
      at(r, "comment"),
      at(r, "businessNote"),
    ].filter(Boolean);

    rows.push({
      companyName,
      email: at(r, "email"),
      website: at(r, "website"),
      prefecture: at(r, "prefecture"),
      businessNote: noteParts.length ? noteParts.join(" / ") : null,
    });
  }

  if (rows.length === 0) return { error: "取り込める行がありませんでした" };
  return { rows, dropped, headers: headers.filter(Boolean) };
}

/** 画面で確認した行をDBへ入れる。配信停止のメールは弾く。 */
export async function addOutreachLeadsFromRows(
  rows: ImportRow[]
): Promise<{ error?: string; added?: number; skippedOptOut?: number; skippedDup?: number }> {
  const info = await getSessionInfo();
  if (!info || (info.role !== "ADMIN" && info.role !== "MANAGER")) {
    return { error: "権限がありません" };
  }
  if (!rows?.length) return { added: 0 };
  if (rows.length > MAX_ROWS) return { error: `一度に取り込めるのは${MAX_ROWS}件までです` };

  const optOuts = new Set(
    (await db.outreachOptOut.findMany({ select: { email: true } })).map((o) => o.email.toLowerCase())
  );

  // 自分が既に持っている会社は入れない（同じ会社に二度アプローチしないため）
  const existing = new Set(
    (
      await db.outreachLead.findMany({
        where: { ownerEmail: info.email },
        select: { companyName: true },
      })
    ).map((l) => l.companyName.trim())
  );

  let skippedOptOut = 0;
  let skippedDup = 0;
  const seen = new Set<string>();
  const data: {
    companyName: string; email: string | null; website: string | null;
    prefecture: string | null; businessNote: string | null;
    ownerEmail: string; ownerName: string; senderEmail: string;
  }[] = [];

  for (const r of rows) {
    const companyName = r.companyName?.trim();
    if (!companyName) continue;

    const email = r.email?.trim().toLowerCase() || null;
    if (email && optOuts.has(email)) { skippedOptOut++; continue; }
    if (existing.has(companyName) || seen.has(companyName)) { skippedDup++; continue; }
    seen.add(companyName);

    data.push({
      companyName,
      email,
      website: r.website?.trim() || null,
      prefecture: r.prefecture?.trim() || null,
      businessNote: r.businessNote?.trim() || null,
      ownerEmail: info.email,
      ownerName: info.staffName,
      senderEmail: info.email,
    });
  }

  if (data.length === 0) return { added: 0, skippedOptOut, skippedDup };

  try {
    const result = await db.outreachLead.createMany({ data });
    logAudit({
      action: "outreach_leads_imported",
      email: info.email,
      name: info.staffName,
      entity: "outreach_lead",
      entityId: `${result.count}件`,
      detail: `リード書き出しから取り込み ${result.count}件（配信停止${skippedOptOut} / 重複${skippedDup}）`,
    });
    revalidatePath("/dashboard/outreach-pipeline");
    return { added: result.count, skippedOptOut, skippedDup };
  } catch (e) {
    console.error("[addOutreachLeadsFromRows] DB error:", e instanceof Error ? e.message : e);
    return { error: "取り込みに失敗しました" };
  }
}

/** 取り込み後にメールだけ後から埋める。空文字で消去もできる。 */
export async function updateOutreachLeadEmail(
  id: string,
  email: string
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info || (info.role !== "ADMIN" && info.role !== "MANAGER")) {
    return { error: "権限がありません" };
  }
  const value = email.trim().toLowerCase();
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { error: "メールアドレスの形式が正しくありません" };
  }
  if (value) {
    const stopped = await db.outreachOptOut.findUnique({ where: { email: value } });
    if (stopped) return { error: "このアドレスは配信停止リストに登録されています" };
  }

  const where = info.role === "ADMIN" ? { id } : { id, ownerEmail: info.email };
  const res = await db.outreachLead.updateMany({ where, data: { email: value || null } });
  if (res.count === 0) return { error: "権限がありません" };
  revalidatePath("/dashboard/outreach-pipeline");
  return {};
}
