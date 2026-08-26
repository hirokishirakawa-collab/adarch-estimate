// ---------------------------------------------------------------
// AIに書き出させた「動き」JSONの取り込み。
//   OSを使わずに営業している代表が、自分のメール・スプレッドシート・メモを
//   Gemini / ChatGPT / Claude に渡し、決まった形のJSONで返させて /move に貼る。
//   ここは純粋な整形だけ（DBに触らない）。クライアントでもサーバーでも同じ関数で検査する。
// ---------------------------------------------------------------
import type { GroupMoveMethod, GroupMoveStage } from "@/generated/prisma/client";
import {
  BOARD_INDUSTRIES,
  METHOD_OPTIONS,
  STAGE_OPTIONS,
  normalizeIndustry,
} from "@/lib/constants/group-move";

/** 1度に貼れる上限。これを超えるなら分けてもらう */
export const MAX_ROWS = 200;

/** 取り込み後の1行（検査済み） */
export interface MoveRow {
  company: string;
  industry: string;
  method: GroupMoveMethod;
  stage: GroupMoveStage;
  /** YYYY-MM-DD。無ければ今日 */
  date: string | null;
  note: string | null;
}

/** 検査に落ちた行。何行目が何で落ちたかを表に出す */
export interface RowError {
  index: number;
  company: string;
  reason: string;
}

// ---------------------------------------------------------------
// AIに渡す指示文。OSの選択肢と同じ語を並べて、そのまま返させる。
//   ⚠️ 金額は項目に入れない（GROUP LIVE / ボードの両方に金額は出さないため）。
// ---------------------------------------------------------------
export function buildMovesPrompt(): string {
  const industries = BOARD_INDUSTRIES.join(" / ");
  const methods = METHOD_OPTIONS.map((m) => m.label).join(" / ");
  const stages = STAGE_OPTIONS.map((s) => s.label).join(" / ");
  return [
    "あなたは営業記録を整理するアシスタントです。",
    "この後に貼る私の営業記録（メール・表・メモなど）から、会社ごとの「営業の動き」を抜き出し、",
    "次のJSONだけを返してください。説明文やコードブロック記号は付けないでください。",
    "",
    "{",
    '  "records": [',
    "    {",
    '      "company": "会社名（正式名称。株式会社などを含む）",',
    `      "industry": "次のどれか1つ: ${industries}",`,
    `      "method": "次のどれか1つ: ${methods}",`,
    `      "stage": "次のどれか1つ: ${stages}",`,
    '      "date": "その動きがあった日 YYYY-MM-DD（不明なら空文字）",',
    '      "note": "ひとこと（120字以内。金額は書かない。不明なら空文字）"',
    "    }",
    "  ]",
    "}",
    "",
    "ルール:",
    "- 同じ会社は最新の1件だけにする",
    "- 業界・当たり方・段階は上の選択肢の語をそのまま使う（言い換えない）",
    "- 分からない項目は無理に埋めず、業界は「その他」、当たり方は「その他」、段階は「当たってる」にする",
    "- 金額・単価・見積額は絶対に書かない",
    "",
    "以下が営業記録です:",
  ].join("\n");
}

// ---------------------------------------------------------------
// 言葉の揺れを吸収する対応表。
//   AIが選択肢の語をそのまま返すのが前提だが、英語のenum値や短い言い方も受ける。
// ---------------------------------------------------------------
const METHOD_ALIASES: Record<string, GroupMoveMethod> = {
  FORM: "FORM", フォーム: "FORM", 問い合わせフォーム: "FORM", 問合せフォーム: "FORM", お問い合わせフォーム: "FORM",
  EMAIL: "EMAIL", メール: "EMAIL", mail: "EMAIL", "e-mail": "EMAIL",
  DM: "DM", "DM（SNS等）": "DM", "DM(SNS等)": "DM", SNS: "DM", Instagram: "DM", LINE: "DM",
  PHONE: "PHONE", 電話: "PHONE", 架電: "PHONE", TEL: "PHONE",
  VISIT: "VISIT", 訪問: "VISIT", 飛び込み: "VISIT", "訪問・飛び込み": "VISIT", 来社: "VISIT",
  REFERRAL: "REFERRAL", 紹介: "REFERRAL", ご紹介: "REFERRAL",
  EXISTING: "EXISTING", 既存客: "EXISTING", 既存: "EXISTING", 既存顧客: "EXISTING", リピート: "EXISTING",
  OTHER: "OTHER", その他: "OTHER",
};

const STAGE_ALIASES: Record<string, GroupMoveStage> = {
  APPROACHING: "APPROACHING", 当たってる: "APPROACHING", 当たっている: "APPROACHING", アプローチ中: "APPROACHING",
  送付済み: "APPROACHING", 送付: "APPROACHING", 連絡済み: "APPROACHING", 返事待ち: "APPROACHING",
  REPLIED: "REPLIED", 反応あり: "REPLIED", 返信あり: "REPLIED", 返信: "REPLIED",
  MEETING: "MEETING", 打合せ: "MEETING", 打ち合わせ: "MEETING", 商談: "MEETING", 面談: "MEETING", アポ: "MEETING",
  PROPOSAL: "PROPOSAL", 提案中: "PROPOSAL", 提案: "PROPOSAL", 見積提出: "PROPOSAL", 見積: "PROPOSAL",
  WON: "WON", 受注: "WON", 成約: "WON", 契約: "WON",
  LOST: "LOST", 見送り: "LOST", 失注: "LOST", お断り: "LOST", NG: "LOST",
};

function lookup<T>(table: Record<string, T>, raw: unknown): T | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (table[v] !== undefined) return table[v];
  const upper = v.toUpperCase();
  if (table[upper] !== undefined) return table[upper];
  // 「メール（返信なし）」のように補足が付いても頭が合えば拾う
  const hit = Object.keys(table).find((k) => k.length >= 2 && v.startsWith(k));
  return hit ? table[hit] : null;
}

const INDUSTRY_SET = new Set<string>(BOARD_INDUSTRIES);

/** 「30万」「¥120,000」「50万円」「3千円」など金額らしき表現 */
const AMOUNT_RE = /[¥￥]\s*[0-9０-９]|[0-9０-９][0-9０-９,，]*\s*(万円|千円|億円|万|円)/;

/** 業界はボードの語に寄せる。対応表にない語は「その他」でなく元の語を残す（情報を捨てない） */
function toIndustry(raw: unknown): string {
  if (typeof raw !== "string") return "その他";
  const v = normalizeIndustry(raw);
  if (INDUSTRY_SET.has(v)) return v;
  // 「飲食」「建設」のように頭だけ合う語は寄せる
  const hit = BOARD_INDUSTRIES.find((b) => b.startsWith(v) || v.startsWith(b.split("・")[0]));
  return hit ?? v.slice(0, 40);
}

function toDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime()) || dt.getUTCMonth() !== mo - 1) return null;
  // 未来日と、あまりに古い日は「今日扱い」に落とす（movedAt が壊れるのを防ぐ）
  const now = Date.now();
  if (dt.getTime() > now + 86400000) return null;
  if (now - dt.getTime() > 365 * 86400000) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------------------------------------------------------------
// 貼られた文字列 → 行。
//   AIが ```json ``` で囲んだり、前後に説明を付けてきても、最初の { から最後の } を拾う。
//   配列だけ返ってきた場合（[{...}]）も受ける。
// ---------------------------------------------------------------
export function parseMovesJson(text: string): { rows: MoveRow[]; errors: RowError[]; fatal?: string } {
  const src = text.trim();
  if (!src) return { rows: [], errors: [], fatal: "何も貼られていません" };

  const start = Math.min(
    ...[src.indexOf("{"), src.indexOf("[")].filter((i) => i >= 0)
  );
  const end = Math.max(src.lastIndexOf("}"), src.lastIndexOf("]"));
  if (!Number.isFinite(start) || end < start) {
    return { rows: [], errors: [], fatal: "JSONの形になっていません（{ } で囲まれた部分が見つかりません）" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(src.slice(start, end + 1));
  } catch {
    return { rows: [], errors: [], fatal: "JSONとして読めませんでした。AIに「JSONだけを返して」と言い直してください" };
  }

  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)
      ? ((parsed as { records: unknown[] }).records)
      : [];

  if (list.length === 0) {
    return { rows: [], errors: [], fatal: "records が空です" };
  }
  if (list.length > MAX_ROWS) {
    return { rows: [], errors: [], fatal: `一度に貼れるのは${MAX_ROWS}件までです。分けて貼ってください` };
  }

  const rows: MoveRow[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  list.forEach((item, i) => {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const company = typeof o.company === "string" ? o.company.trim().slice(0, 80) : "";
    if (!company) {
      errors.push({ index: i, company: "", reason: "会社名が空" });
      return;
    }
    const key = company.replace(/\s+/g, "");
    if (seen.has(key)) {
      errors.push({ index: i, company, reason: "同じ会社が2回出ています（後の行を捨てました）" });
      return;
    }
    seen.add(key);

    const method = lookup(METHOD_ALIASES, o.method) ?? "OTHER";
    const stage = lookup(STAGE_ALIASES, o.stage) ?? "APPROACHING";
    const industry = toIndustry(o.industry);
    // 金額はボードにもLIVEにも出さない決まりなので、ひとことに金額らしき語があれば丸ごと落とす
    const rawNote = typeof o.note === "string" ? o.note.trim().slice(0, 120) : "";
    const note = rawNote && !AMOUNT_RE.test(rawNote) ? rawNote : null;
    const date = toDate(o.date);

    rows.push({ company, industry, method, stage, date, note });
  });

  return { rows, errors };
}
