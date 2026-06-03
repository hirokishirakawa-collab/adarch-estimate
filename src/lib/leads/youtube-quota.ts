// ---------------------------------------------------------------
// YouTube Data API の日次クォータ・ガード
//
// 背景: YouTube Data API v3 の無料枠は 10,000 ユニット/日。
//   search.list = 100 ユニット/回。1クロール ≈ 12キーワード = 約1,200ユニット。
//   手動クロールの連打などで枠を使い切ると、毎朝の自動クロール(cron)も 429 で全滅する。
//
// 対策: その日の消費量を永続ボリューム(/data)にJSONで記録し、
//   - 手動クロール: 「日次上限 − cron予約枠」までしか使わせない
//   - cron(自動): 予約枠まで使える
//   ことで、朝のcronぶんのクォータを必ず温存する。
//
// クォータは太平洋時間(America/Los_Angeles)の深夜にリセットされるため、
// 日付判定も太平洋時間で行う。
// ---------------------------------------------------------------

import { promises as fs } from "fs";
import path from "path";

// search.list 1回の消費ユニット
export const YOUTUBE_SEARCH_UNIT_COST = 100;

const QUOTA_FILE =
  process.env.YOUTUBE_QUOTA_FILE ?? "/data/youtube-quota.json";
// 1日の上限（無料枠）。実消費にやや余裕を見て既定 9,500。
const DAILY_LIMIT = Number(process.env.YOUTUBE_DAILY_LIMIT ?? 9_500);
// cron(毎朝の自動クロール)のために常に残しておくユニット数（≈1クロール分）。
const CRON_RESERVE = Number(process.env.YOUTUBE_CRON_RESERVE ?? 1_500);

interface Usage {
  date: string; // 太平洋時間の YYYY-MM-DD
  units: number;
}

function pacificDate(): string {
  // 例: "2026-06-03"（en-CA は YYYY-MM-DD 形式）
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function read(): Promise<Usage> {
  try {
    const raw = await fs.readFile(QUOTA_FILE, "utf8");
    const u = JSON.parse(raw) as Usage;
    // 日付が変わっていればリセット
    if (u.date === pacificDate()) return u;
  } catch {
    /* ファイル無し/壊れ → 当日ゼロ扱い */
  }
  return { date: pacificDate(), units: 0 };
}

export interface YoutubeQuotaDecision {
  ok: boolean; // このクロールでYouTube検索を実行してよいか
  usedToday: number; // 当日の既消費ユニット
  ceiling: number; // この呼び出しに適用される上限
}

/**
 * このクロールでYouTube検索を実行してよいか判定する。
 * - isCron=true : 上限は DAILY_LIMIT（予約枠まで使える）
 * - isCron=false: 上限は DAILY_LIMIT − CRON_RESERVE（cronぶんを残す）
 */
export async function canQueryYoutube(opts: {
  isCron: boolean;
  estimatedUnits: number;
}): Promise<YoutubeQuotaDecision> {
  const { units } = await read();
  const ceiling = opts.isCron ? DAILY_LIMIT : DAILY_LIMIT - CRON_RESERVE;
  return {
    ok: units + opts.estimatedUnits <= ceiling,
    usedToday: units,
    ceiling,
  };
}

/** 実際に消費したユニットを当日分に加算して永続化する。 */
export async function addYoutubeUsage(units: number): Promise<void> {
  if (units <= 0) return;
  const cur = await read();
  cur.units += units;
  try {
    await fs.mkdir(path.dirname(QUOTA_FILE), { recursive: true });
    await fs.writeFile(QUOTA_FILE, JSON.stringify(cur), "utf8");
  } catch (e) {
    console.error("[youtube-quota] 使用量の書き込みに失敗:", e);
  }
}
