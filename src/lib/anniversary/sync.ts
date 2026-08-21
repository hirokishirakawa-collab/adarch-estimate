// ==============================================================
// 周年ファインダーの同期
//
//   1. 手持ちリードの自社サイトを巡回して設立・創業年を埋める（本命）
//   2. PR TIMES から「周年を打ち出している会社」を拾う（新規発掘）
//
// Railway の cron は長く回せないので、1回の実行量に上限を置く。
// 途中で切れても1件ずつ保存しているので、次回は続きから進む。
// ==============================================================

import { runFoundingCrawl, type CrawlStats } from "./crawl";
import { runAnniversaryDiscovery, type DiscoverStats } from "./prtimes";

export interface AnniversarySyncStats {
  crawl: CrawlStats;
  discovery: DiscoverStats;
}

export async function runAnniversarySync(opts?: {
  crawlLimit?: number;
  discoverPerKeyword?: number;
}): Promise<AnniversarySyncStats> {
  const discovery = await runAnniversaryDiscovery(opts?.discoverPerKeyword ?? 15);
  const crawl = await runFoundingCrawl(opts?.crawlLimit ?? 80);
  return { crawl, discovery };
}
