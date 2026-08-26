// Drive 実績フォルダ（portfolio_items）の案件フォルダから「会社名らしいもの」を仕分けて一覧にする（登録はしない）
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isSameCompany } from "../../src/lib/clients/normalize";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const OUT = process.argv[2];

/** 動画タイトル・素材名らしいもの（会社名ではない） */
const TITLE_RE = /聞く|に聞|[！!？?#]|ウォーク|自販機|おごり|修正版|Interview|総集編|について|お仕事|^cm$|^\d+FW$|^スマートフォン$|^ポッキー$|^福岡$|^岡山$|^\d+$|^[a-z]{1,3}$|movie|OP|LOGO|\.mp4|\.mov|\.pdf|タペストリー|パンフ|チラシ|ポスター|名刺|ロゴ|字幕|素材|テロップ|BGM|ナレーション|version|ver\.|v\d|final|draft|完成|納品|仮|テスト/i;

/** 目視で「会社名ではない」と判断したもの（動画タイトル・素材・企画名・地名） */
const EXCLUDE = new Set(["ポッキー","イベント告知","イベント報告","国連NY","天童先生","神戸港ハンブルク港湾会議","難民支援","シネマバード","ロンドンハーツ","楽天イーグルス中継","1inch","KUROKOHAKU","ThisIsEng","ライスシロップ","中南米事業紹介","日本酒","神戸港","難民向け動画","Bリーグスタジアムのスポンサー広告","アイスホッケー","サッカー","ラクロス","DontLaughAtMySong","EscapeThePoliceDogs","QuizConquest","★Q","イングリッシュトレーニング","オムレツづくり","お茶のトレーニング","クッションの交換方法","トラブル報告","トラブル報告書","修正TAKE","完パケ","岩手","従業員食堂①","従業員食堂②わんぱく編","新しいカクテルの試作中","松林図屏風・洛中洛外図屏風柿の種詰合せ","N社","スマ料理人","姫スマ","媛スマ","アイメット","クルム","SHIMENAWA","楽天証券"]);
/** 同じ会社の別表記 → 登録名（既存の顧客・アーカイブ名に寄せる） */
const ALIAS: Record<string, string> = {
  "amazon": "Amazon", "AmazonNGO3": "Amazon", "Amazon fresh": "Amazon",
  "NTT DATA": "NTTデータ", "Japanet": "ジャパネットたかた", "JAPANET": "ジャパネットたかた",
  "パーソル": "PERSOL", "本高砂屋": "本髙砂屋", "信玄": "信玄食品", "MINDWIND": "マインドウインド",
  "国立子ども図書館": "国立国際こども図書館", "国際子ども図書館オーゲモーラ": "国立国際こども図書館",
  "井筒屋山口": "山口井筒屋", "イノフィス": "Innophys", "TV東京海外向け": "テレビ東京", "三越350周年": "三越伊勢丹",
  "3x3": "3×3.PREMIER EXE", "高山村メロディ花火": "群馬県高山村", "北辰フーズ〉文鳥 辛夷花・上野清水堂不忍ノ池　フルーツゼリー詰合せ": "北辰フーズ",
  "うたメモリーLong": "うたメモリー", "坂下": "坂下国際税理士事務所", "VR-learning 髙田工業株式会社": "髙田工業",
  "BENG": "ビジネスエンジニアリング", "beng": "ビジネスエンジニアリング", "FLOWIN": "Cuore",
  "Johnson and Johnson 新アンバサダー記者会見": "Johnson & Johnson", "SBC-湘南美容外科 北千住院-": "湘南美容クリニック 北千住院",
  "原田工房株式会社(茨城）": "原田工房", "PROLOGUE 北千住店": "PROLOGUE", "一社)茨城南青年会議所50周年記念": "茨城南青年会議所",
};
function clientFromFolder(name: string): { client: string | null; reason?: string } {
  let n = name.replace(/\.(mp4|mov|pdf|jpg|png|zip)$/i, "").replace(/\((1080p|4k|720p)\)/gi, "").trim();
  if (!n || n.startsWith(".")) return { client: null, reason: "空/隠しファイル" };
  const br = n.match(/^[〈<【\[（(]([^〉>】\]）)]+)[〉>】\]）)]/);
  if (br) n = br[1];
  n = n.replace(/様$|さま$|御中$/, "").replace(/[_＿].*$/, "").replace(/\s*\d{4}年?.*$/, "").replace(/\(.*?\)|（.*?）/g, "").trim();
  if (!n) return { client: null, reason: "空" };
  if (EXCLUDE.has(n)) return { client: n, reason: "会社名ではない（目視）" };
  if (ALIAS[n]) n = ALIAS[n];
  if (TITLE_RE.test(n) || TITLE_RE.test(name)) return { client: n, reason: "動画タイトル・素材名らしい" };
  if (n.length <= 1) return { client: n, reason: "短すぎる" };
  return { client: n };
}

(async () => {
  const items = await db.portfolioItem.findMany({ where: { depth: 2 }, select: { name: true, path: true, itemType: true, driveUrl: true, lastUpdated: true, parentName: true }, orderBy: { path: "asc" } });
  const children = await db.portfolioItem.findMany({ where: { depth: 3 }, select: { parentName: true } });
  const childCount = new Map<string, number>();
  for (const c of children) if (c.parentName) childCount.set(c.parentName, (childCount.get(c.parentName) ?? 0) + 1);
  const customers = await db.customer.findMany({ where: { branchId: { not: "branch_archive" } }, select: { name: true } });
  const archive = await db.customer.findMany({ where: { branchId: "branch_archive" }, select: { name: true } });

  const rows: { no: number; folder: string; category: string; client: string; judge: string; match: string; files: number; year: string; url: string }[] = [];
  const seen = new Map<string, number>();
  let no = 0;
  for (const it of items) {
    const category = (it.parentName ?? "").replace(/^\d{3}\./, "");
    const { client, reason } = clientFromFolder(it.name);
    const files = childCount.get(it.name) ?? 0;
    const year = it.lastUpdated ? String(new Date(it.lastUpdated).getFullYear()) : "";
    if (!client) continue;
    let judge = "登録"; let match = "";
    if (reason) judge = `除外（${reason}）`;
    else if (customers.some((x) => isSameCompany(x.name, client))) { judge = "既存顧客に紐づけ"; match = customers.find((x) => isSameCompany(x.name, client))!.name; }
    else if (archive.some((x) => isSameCompany(x.name, client))) { judge = "実績アーカイブに紐づけ（登録済）"; match = archive.find((x) => isSameCompany(x.name, client))!.name; }
    else if (seen.has(client)) { judge = `同名あり（No.${seen.get(client)}と同じ会社）`; }
    if (!seen.has(client)) seen.set(client, no + 1);
    rows.push({ no: ++no, folder: it.name, category, client, judge, match, files, year, url: it.driveUrl });
  }
  const csvCell = (v: string | number) => { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = ["No,判定,会社名（私の読み取り）,Driveのフォルダ名,カテゴリ,一致した顧客,配下ファイル数,最終更新年,DriveURL", ...rows.map((r) => [r.no, r.judge, r.client, r.folder, r.category, r.match, r.files, r.year, r.url].map(csvCell).join(","))].join("\n");
  writeFileSync(OUT + ".csv", "﻿" + csv);
  const cnt = (k: string) => rows.filter((r) => r.judge.startsWith(k)).length;
  const md = [`# Drive 実績フォルダ → 取引先マップ 取込候補（${rows.length}件）`, "", `- 登録（新規・実績アーカイブへ）: ${cnt("登録")}件`, `- 既存顧客に紐づけ: ${cnt("既存")}件`, `- 実績アーカイブに紐づけ（登録済55社と一致）: ${cnt("実績アーカイブ")}件`, `- 同名あり（まとめる）: ${cnt("同名")}件`, `- 除外（動画タイトル等）: ${cnt("除外")}件`, "", "| No | 判定 | 会社名（読み取り） | Driveフォルダ名 | カテゴリ | 一致 | 配下 | 年 |", "|---|---|---|---|---|---|---|---|", ...rows.map((r) => `| ${r.no} | ${r.judge} | ${r.client} | ${r.folder} | ${r.category} | ${r.match} | ${r.files} | ${r.year} |`)].join("\n");
  writeFileSync(OUT + ".md", md);
  console.log(JSON.stringify({ total: rows.length, register: cnt("登録"), existing: cnt("既存"), archive: cnt("実績アーカイブ"), dup: cnt("同名"), excluded: cnt("除外") }));
  process.exit(0);
})();
