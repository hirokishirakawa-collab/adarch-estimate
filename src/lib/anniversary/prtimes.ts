// ==============================================================
// PR TIMES から「周年を打ち出している会社」を拾って営業リストへ入れる
//
// 実測（2026-08-21）: キーワード「周年」で取れた10件のうち7件が周年リリース。
// ただし取れるのは大手・ゲーム・ブランドが多く、地方の中小はあまり出てこない。
// 母数を稼ぐ場所ではなく、「記念事業に予算がついた会社」を拾う場所として使う。
//
// 大事な線引き:
//   「キッザニア日本上陸20周年」のようなブランド周年は、会社の創業年ではない。
//   タイトルが 創業/設立/創立 と言っている時だけ foundedYear を入れ、
//   それ以外は「周年の発信をした」という購買シグナルとしてだけ残す。
// ==============================================================

import { db } from "@/lib/db";
import { fetchPrTimesByKeyword, fetchPrTimesArticle } from "@/lib/leads/tvcm-prtimes";
import { crawlFounding } from "./crawl";
import { PREFECTURES } from "@/lib/constants/crm";

/** 周年リリースを拾うキーワード */
export const ANNIVERSARY_KEYWORDS = ["周年", "創業", "創立"];

/**
 * 同業（＝競合）とみて営業リストに入れない社名。
 *
 * 周年リリースは広告・映像の会社自身が出すことも多く、そのまま入れると
 * 競合に「創業◯周年おめでとうございます」と声をかける事故になる。
 *
 * 広く取りすぎると顧客になり得る会社まで消えるので、社名だけで同業と言い切れる語に絞る。
 * 「印刷」「デザイン」「メディア」は顧客になり得るので**入れない**。
 * ここで拾い切れなかったものは、画面の「営業対象から外す」で人が外す。
 */
const COMPETITOR_NAME_RE =
  /映像制作|動画制作|映像プロダクション|広告代理店|総合広告|広告社|広告会社|アドエージェンシー|クリエイティブエージェンシー/;

/** 「創業50周年」のように会社そのものの周年を指すタイトルか */
const FOUNDING_ANNIV_RE = /(創業|設立|創立|開業)\s*(\d{1,3})\s*(?:周年|年)/;
/** 「20周年」全般（ブランド周年を含む） */
const ANY_ANNIV_RE = /(\d{1,3})\s*周年/;

function pickPrefecture(text: string): string | null {
  // 「本社:東京都中央区」の形が多い。無ければ本文の最初に出てくる都道府県名。
  const honsha = text.match(/本社[^。]{0,20}?(北海道|(?:京都|大阪)府|東京都|(?:[^\s]{2,3}県))/);
  const prefs: readonly string[] = PREFECTURES;
  if (honsha && prefs.includes(honsha[1])) return honsha[1];
  for (const p of prefs) {
    if (text.includes(p)) return p;
  }
  return null;
}

function pickWebsite(text: string): string | null {
  const m = text.match(/(?:URL|ＵＲＬ|ホームページ|公式サイト|コーポレートサイト)[\s:：]*((?:https?:\/\/)[^\s"'）)、]+)/);
  if (m) return m[1];
  return null;
}

function pickCompanyName(jsonLd: string | null, bodyText: string): string | null {
  if (jsonLd) {
    try {
      const parsed = JSON.parse(jsonLd);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of arr) {
        const name = node?.author?.name ?? node?.publisher?.name;
        if (typeof name === "string" && name.trim()) return name.trim();
      }
    } catch {
      /* 壊れたJSON-LDは無視して本文にフォールバック */
    }
  }
  const m = bodyText.match(/([^\s]{2,40}(?:株式会社|有限会社|合同会社))/);
  return m ? m[1] : null;
}

export interface DiscoverStats {
  scanned: number;
  anniversaryHits: number;
  created: number;
  updated: number;
  skipped: number;
  /** 同業とみて入れなかった件数 */
  skippedCompetitor: number;
}

/**
 * PR TIMES を周年キーワードで巡回して、リードを作る/更新する。
 * 1回の実行で maxPerKeyword 件だけ見る（cron が切れても次回続きから）。
 */
export async function runAnniversaryDiscovery(maxPerKeyword = 15): Promise<DiscoverStats> {
  const stats: DiscoverStats = { scanned: 0, anniversaryHits: 0, created: 0, updated: 0, skipped: 0, skippedCompetitor: 0 };
  const seenUrls = new Set<string>();

  for (const keyword of ANNIVERSARY_KEYWORDS) {
    const items = await fetchPrTimesByKeyword(keyword, maxPerKeyword);
    for (const item of items) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      stats.scanned++;

      const anyAnniv = item.title.match(ANY_ANNIV_RE);
      const foundingAnniv = item.title.match(FOUNDING_ANNIV_RE);
      if (!anyAnniv && !foundingAnniv) continue;
      stats.anniversaryHits++;

      const article = await fetchPrTimesArticle(item.url);
      if (!article) { stats.skipped++; continue; }

      const name = pickCompanyName(article.jsonLd, article.bodyText);
      if (!name) { stats.skipped++; continue; }

      // 同業は最初から入れない（競合に周年の声をかける事故を防ぐ）
      if (COMPETITOR_NAME_RE.test(name)) {
        stats.skippedCompetitor++;
        continue;
      }

      const prefecture = pickPrefecture(article.bodyText);
      const website = pickWebsite(article.bodyText);

      // 会社の創業年。タイトルが「創業50周年」と言っている時だけ逆算してよい。
      // ブランド周年（例: 日本上陸20周年）は創業年ではないので入れない。
      let foundedYear: number | null = null;
      let foundedMonth: number | null = null;
      let foundedRaw: string | null = null;
      let foundedSource: string | null = null;
      let foundedSourceUrl: string | null = null;

      if (foundingAnniv) {
        const years = Number(foundingAnniv[2]);
        const pubYear = new Date().getFullYear();
        if (years >= 1 && years <= 200) {
          foundedYear = pubYear - years;
          foundedRaw = item.title.slice(0, 60);
          foundedSource = "prtimes";
          foundedSourceUrl = item.url;
        }
      }

      // 自社サイトが分かるなら、そちらの会社概要を正とする（月まで取れることがある）
      if (website) {
        const hit = await crawlFounding(website);
        if (hit) {
          foundedYear = hit.year;
          foundedMonth = hit.month;
          foundedRaw = hit.raw;
          foundedSource = "site";
          foundedSourceUrl = hit.sourceUrl;
        }
      }

      const existing = await db.lead.findFirst({ where: { name }, select: { id: true, foundedYear: true } });
      const annivYears = Number((foundingAnniv?.[2] ?? anyAnniv?.[1]) ?? 0);
      const memoLine = `【周年】${annivYears ? `${annivYears}周年 ` : ""}${item.title.slice(0, 80)}\n${item.url}`;

      const foundedData = foundedYear
        ? { foundedYear, foundedMonth, foundedRaw, foundedSource, foundedSourceUrl, foundedCheckedAt: new Date() }
        : {};

      if (existing) {
        await db.lead.update({
          where: { id: existing.id },
          data: {
            // 既に会社概要から取れている年は上書きしない（そちらの方が確かなため）
            ...(existing.foundedYear ? {} : foundedData),
            signalAt: new Date(),
            signalKind: "ANNIV",
            pressReleaseUrl: item.url,
            pressReleaseTitle: item.title.slice(0, 200),
          },
        });
        stats.updated++;
      } else {
        await db.lead.create({
          data: {
            name,
            source: "PR_TIMES_TVCM",
            prefecture,
            websiteUrl: website,
            memo: memoLine,
            signalAt: new Date(),
            signalKind: "ANNIV",
            pressReleaseUrl: item.url,
            pressReleaseTitle: item.title.slice(0, 200),
            ...foundedData,
          },
        });
        stats.created++;
      }
    }
  }

  return stats;
}
