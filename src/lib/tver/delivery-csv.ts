// ==============================================================
// TVer配信レポートCSV（manage.tver.sale「レポート作成 > 配信レポート > ダウンロード」）の読み取り
//   - 文字コード: UTF-8(BOM付き) を基本に、Shift_JIS も受ける
//   - 列名は「別名」で吸収（TVer側の表記ゆれ・空白・引用符）
//   - 「ご利用金額」「CPM」は卸値。売価は 卸値×SELL_MULTIPLIER（src/lib/tver/plan.ts の1か所）
//   - 裏計算: 表示回数 × 秒数別売単価（UNIT_PRICE）。卸値×係数 とのずれを % で持つ
//   - 秒数は キャンペーン名/クリエイティブ名の「15s」「15秒」→ 無ければ 卸CPM（2200/2600/3700）から逆引き
// ==============================================================

import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { SELL_MULTIPLIER, UNIT_PRICE, WHOLESALE_UNIT, type AdSeconds } from "@/lib/tver/plan";

export type DeliveryRow = {
  date: Date;
  campaignId: string;
  campaignName: string;
  adGroupName: string;
  creativeName: string;
  adId: string;
  gender: string;
  age: string;
  prefecture: string;
  device: string;
  clicks: number;
  impressions: number;
  q25: number;
  q50: number;
  q75: number;
  q100: number;
  wholesaleAmount: number;
  wholesaleCpm: number;
  sellAmount: number;
  cv: number;
  indirectCv: number;
  vtcv: number;
};

export type ParsedDelivery = {
  advertiserTverId: string;
  advertiserName: string;
  periodStart: Date;
  periodEnd: Date;
  campaignNames: string[];
  adSeconds: AdSeconds | null;
  rows: DeliveryRow[];
  impressions: number;
  clicks: number;
  completes: number;
  wholesaleAmount: number;
  sellAmount: number;
  sellMultiplier: number;
  crossCheckAmount: number;
  crossCheckDiffPct: number;
  warnings: string[];
};

/** 裏計算とのずれがこの%を超えたら警告（卸値×3 が正・裏計算は検算） */
export const CROSS_CHECK_WARN_PCT = 3;
/** 情報だけの注記の接頭辞（公開の妨げにしない・再取込でも非公開に戻さない） */
export const INFO = "ℹ️ ";
export const isActionWarning = (w: string) => !w.startsWith(INFO);

const ALIASES: Record<string, string[]> = {
  date: ["レポート年月日", "日付", "年月日", "date"],
  accountId: ["アカウントID", "広告主ID", "account id"],
  accountName: ["アカウント名", "広告主名", "広告主", "account name"],
  campaignId: ["キャンペーンID", "campaign id"],
  campaignName: ["キャンペーン名", "キャンペーン", "campaign name"],
  adGroupName: ["広告グループ名", "広告グループ", "ad group name"],
  creativeName: ["クリエイティブ名", "クリエイティブ", "creative name"],
  adId: ["広告ID", "ad id"],
  gender: ["性別", "gender"],
  age: ["年齢", "age"],
  prefecture: ["都道府県", "prefecture"],
  device: ["配信デバイス", "デバイス", "device"],
  clicks: ["クリック数", "クリック", "clicks"],
  impressions: ["表示回数", "インプレッション", "impressions"],
  q25: ["25% 再生回数", "25%再生回数", "25%再生"],
  q50: ["50% 再生回数", "50%再生回数", "50%再生"],
  q75: ["75% 再生回数", "75%再生回数", "75%再生"],
  q100: ["100% 再生回数", "100%再生回数", "100%再生", "完全視聴回数"],
  wholesaleAmount: ["ご利用金額", "利用金額", "金額", "cost", "spend"],
  cpm: ["CPM"],
  cv: ["CV数", "cv"],
  indirectCv: ["間接CV数", "間接cv"],
  vtcv: ["推定VTCV数", "vtcv"],
};

const REQUIRED = ["date", "accountId", "accountName", "campaignName", "impressions", "wholesaleAmount"] as const;

function normalizeHeader(h: string): string {
  return h
    .replace(/﻿/g, "")
    .replace(/^"|"$/g, "")
    .replace(/[\s　]/g, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９％]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}; // field -> raw header
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const used = new Set<string>();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const a of aliases) {
      const t = normalizeHeader(a);
      const hit = normalized.find((h) => h.norm === t && !used.has(h.raw));
      if (hit) {
        map[field] = hit.raw;
        used.add(hit.raw);
        break;
      }
    }
  }
  return map;
}

function decode(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8");
  const utf8 = buf.toString("utf8");
  if (!utf8.includes("�")) return utf8;
  return iconv.decode(buf, "Shift_JIS");
}

const num = (v: unknown): number => {
  const s = String(v ?? "").replace(/[,¥￥%\s"]/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => String(v ?? "").replace(/^"|"$/g, "").trim();

/** 「15s」「15秒」「_30s_」などから秒数を拾う */
export function secondsFromName(name: string): AdSeconds | null {
  const m = name.match(/(?:^|[^0-9])(15|30|60)\s*(?:s|sec|秒)(?![0-9])/i);
  if (!m) return null;
  return Number(m[1]) as AdSeconds;
}

/** 卸CPM（円/1000表示）から秒数を逆引き（2200→15 / 2600→30 / 3700→60） */
export function secondsFromWholesaleCpm(cpm: number): AdSeconds | null {
  for (const s of [15, 30, 60] as AdSeconds[]) {
    if (Math.abs(cpm - WHOLESALE_UNIT[s] * 1000) < 1) return s;
  }
  return null;
}

export function parseDeliveryCsv(buf: Buffer): ParsedDelivery {
  const text = decode(buf);
  const records = parse(text, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true }) as Record<string, string>[];
  if (records.length === 0) throw new Error("CSVに明細行がありません");
  const headers = Object.keys(records[0]);
  const map = buildHeaderMap(headers);
  const missing = REQUIRED.filter((f) => !map[f]);
  if (missing.length) {
    throw new Error(`必要な列が見つかりません: ${missing.map((f) => ALIASES[f][0]).join("・")}（見出し: ${headers.slice(0, 12).join(" / ")}）`);
  }
  const g = (r: Record<string, string>, f: string) => (map[f] ? r[map[f]] : "");

  const rows: DeliveryRow[] = [];
  const accounts = new Map<string, string>();
  const campaigns = new Set<string>();
  const cpmSet = new Map<number, number>();
  let badDates = 0;

  for (const r of records) {
    const dRaw = str(g(r, "date"));
    const d = new Date(dRaw.replace(/\//g, "-") + "T00:00:00+09:00");
    if (!dRaw || isNaN(d.getTime())) {
      badDates++;
      continue;
    }
    const impressions = Math.round(num(g(r, "impressions")));
    const wholesaleAmount = Math.round(num(g(r, "wholesaleAmount")));
    const wholesaleCpm = Math.round(num(g(r, "cpm")));
    const accId = str(g(r, "accountId"));
    const accName = str(g(r, "accountName"));
    if (accId) accounts.set(accId, accName);
    const campaignName = str(g(r, "campaignName"));
    if (campaignName) campaigns.add(campaignName);
    if (wholesaleCpm > 0 && impressions > 0) cpmSet.set(wholesaleCpm, (cpmSet.get(wholesaleCpm) ?? 0) + impressions);
    rows.push({
      date: d,
      campaignId: str(g(r, "campaignId")),
      campaignName,
      adGroupName: str(g(r, "adGroupName")),
      creativeName: str(g(r, "creativeName")),
      adId: str(g(r, "adId")),
      gender: str(g(r, "gender")),
      age: str(g(r, "age")),
      prefecture: str(g(r, "prefecture")),
      device: str(g(r, "device")),
      clicks: Math.round(num(g(r, "clicks"))),
      impressions,
      q25: Math.round(num(g(r, "q25"))),
      q50: Math.round(num(g(r, "q50"))),
      q75: Math.round(num(g(r, "q75"))),
      q100: Math.round(num(g(r, "q100"))),
      wholesaleAmount,
      wholesaleCpm,
      sellAmount: Math.round(wholesaleAmount * SELL_MULTIPLIER),
      cv: Math.round(num(g(r, "cv"))),
      indirectCv: Math.round(num(g(r, "indirectCv"))),
      vtcv: Math.round(num(g(r, "vtcv"))),
    });
  }
  if (rows.length === 0) throw new Error("日付を読める明細行がありません");
  const preWarnings: string[] = [];
  if (badDates) preWarnings.push(`日付を読めない行を ${badDates} 行スキップしました`);
  if (accounts.size > 1) preWarnings.push(`広告主が複数含まれています（${[...accounts.values()].join("・")}）。1広告主ごとにレポートを分けてください`);
  const [advertiserTverId, advertiserName] = accounts.size ? [...accounts.entries()][0] : ["", ""];
  const summary = summarize(rows, advertiserTverId, advertiserName);
  return { ...summary, warnings: [...preWarnings, ...summary.warnings], rows };
}

export type DeliverySummary = Omit<ParsedDelivery, "rows">;

/** 明細から合計・秒数・売価・裏計算・警告を出す（取込時と、週次の差し替え後の再集計で共用） */
export function summarize(rows: DeliveryRow[], advertiserTverId: string, advertiserName: string): DeliverySummary {
  const warnings: string[] = [];
  const campaigns = new Set<string>();
  const cpmSet = new Map<number, number>();
  for (const r of rows) {
    if (r.campaignName) campaigns.add(r.campaignName);
    if (r.wholesaleCpm > 0 && r.impressions > 0) cpmSet.set(r.wholesaleCpm, (cpmSet.get(r.wholesaleCpm) ?? 0) + r.impressions);
  }
  const impressions = rows.reduce((a, r) => a + r.impressions, 0);
  const clicks = rows.reduce((a, r) => a + r.clicks, 0);
  const completes = rows.reduce((a, r) => a + r.q100, 0);
  const wholesaleAmount = rows.reduce((a, r) => a + r.wholesaleAmount, 0);
  const sellAmount = Math.round(wholesaleAmount * SELL_MULTIPLIER);

  // 秒数: 名前 → 卸CPM の順
  const names = [...campaigns, ...new Set(rows.map((r) => r.creativeName))];
  let adSeconds: AdSeconds | null = null;
  for (const n of names) {
    const s = secondsFromName(n);
    if (s) {
      adSeconds = s;
      break;
    }
  }
  const dominantCpm = [...cpmSet.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const cpmSeconds = dominantCpm ? secondsFromWholesaleCpm(dominantCpm) : null;
  if (!adSeconds) adSeconds = cpmSeconds;
  if (adSeconds && cpmSeconds && adSeconds !== cpmSeconds) warnings.push(`名前は${adSeconds}秒ですが主な卸CPMは${cpmSeconds}秒の価格です。秒数の登録違いの可能性があります`);

  // 価格表に無い卸CPM＝売価は卸値×係数で正しく出ている（情報として残す。公開の妨げにはしない）
  const unknownCpms = [...cpmSet.entries()].filter(([c]) => !secondsFromWholesaleCpm(c));
  if (unknownCpms.length) {
    const share = unknownCpms.reduce((a, [, n]) => a + n, 0) / Math.max(1, impressions);
    warnings.push(`${INFO}価格表（15秒¥2,200／30秒¥2,600／60秒¥3,700）に無い卸CPM ${unknownCpms.map(([c]) => `¥${c.toLocaleString("ja-JP")}`).join("・")} が含まれます（表示回数の${Math.round(share * 100)}%）。売価は卸値×${SELL_MULTIPLIER}で計算済みのため金額は正しいです。TVer側の単価変更や特別枠でないか確認してください`);
  }
  if (cpmSet.size > 1) warnings.push(`${INFO}卸CPMが複数あります（${[...cpmSet.entries()].map(([c, n]) => `¥${c.toLocaleString("ja-JP")}=${n.toLocaleString("ja-JP")}表示`).join("・")}）。裏計算は単価ごとに行っています`);

  // 裏計算＝行ごとに「その行の卸CPMに対応する秒数の売単価」×表示回数。価格表に無いCPMは そのCPM×係数
  const unitFor = (cpm: number): number => {
    const sec = cpm > 0 ? secondsFromWholesaleCpm(cpm) : null;
    if (sec) return UNIT_PRICE[sec];
    if (cpm > 0) return (cpm / 1000) * SELL_MULTIPLIER;
    return adSeconds ? UNIT_PRICE[adSeconds] : 0;
  };
  const crossCheckAmount = Math.round(rows.reduce((a, r) => a + r.impressions * unitFor(r.wholesaleCpm), 0));
  const crossCheckDiffPct = sellAmount > 0 && crossCheckAmount > 0 ? Math.round((Math.abs(sellAmount - crossCheckAmount) / sellAmount) * 10000) / 100 : 0;
  if (!adSeconds && cpmSet.size === 0) warnings.push("秒数も卸CPMも判定できないため裏計算（表示回数×売単価）ができません");
  else if (crossCheckDiffPct > CROSS_CHECK_WARN_PCT) warnings.push(`裏計算とのずれ ${crossCheckDiffPct}%（卸値×${SELL_MULTIPLIER}＝¥${sellAmount.toLocaleString("ja-JP")}／表示回数×単価＝¥${crossCheckAmount.toLocaleString("ja-JP")}）。ご利用金額と表示回数×CPMが合っていません。CSVの列がずれていないか確認してから公開してください`);

  const dates = rows.map((r) => r.date.getTime());
  return {
    advertiserTverId,
    advertiserName,
    periodStart: new Date(Math.min(...dates)),
    periodEnd: new Date(Math.max(...dates)),
    campaignNames: [...campaigns],
    adSeconds,
    impressions,
    clicks,
    completes,
    wholesaleAmount,
    sellAmount,
    sellMultiplier: SELL_MULTIPLIER,
    crossCheckAmount,
    crossCheckDiffPct,
    warnings,
  };
}

/** キャンペーン名などに含まれるOSの申込番号「TV-2026-0042」→ 42。無ければ null */
export function orderNumberFromName(name: string): number | null {
  const m = name.match(/TV-\d{4}-(\d{4,})/i);
  return m ? Number(m[1]) : null;
}

/** 明細を「日×キャンペーン×広告グループ×クリエイティブ×広告×性別×年齢×県×デバイス」で一意にするキー */
export function rowKey(r: Pick<DeliveryRow, "date" | "campaignId" | "adGroupName" | "creativeName" | "adId" | "gender" | "age" | "prefecture" | "device">): string {
  return [r.date.toISOString().slice(0, 10), r.campaignId, r.adGroupName, r.creativeName, r.adId, r.gender, r.age, r.prefecture, r.device].join("|");
}

/** 拠点に見せる集計（卸値は含めない） */
export type Breakdown = { key: string; impressions: number; completes: number; clicks: number; sellAmount: number };
export function breakdown<T extends { impressions: number; q100: number; clicks: number; sellAmount: number }>(rows: T[], by: (r: T) => string): Breakdown[] {
  const m = new Map<string, Breakdown>();
  for (const r of rows) {
    const k = by(r) || "—";
    const b = m.get(k) ?? { key: k, impressions: 0, completes: 0, clicks: 0, sellAmount: 0 };
    b.impressions += r.impressions;
    b.completes += r.q100;
    b.clicks += r.clicks;
    b.sellAmount += r.sellAmount;
    m.set(k, b);
  }
  return [...m.values()].sort((a, b) => b.impressions - a.impressions);
}
