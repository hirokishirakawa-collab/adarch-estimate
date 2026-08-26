// ==============================================================
// 会社概要ページのテキストから「従業員数・資本金・代表者」を拾う
//
// 周年ファインダーの設立年抽出（anniversary/extract.ts）と同じ考え方:
//   - 素直な正規表現で候補を集め、範囲外は誤抽出として捨てる
//   - 取れなかった項目は null のまま（推測で埋めない）
//   - 原文を証跡として残し、人が目で弾けるようにする
// ==============================================================

import { normalizeText } from "@/lib/anniversary/extract";

export interface CompanyProfile {
  employeeCount: number | null;
  capital: bigint | null;
  representativeName: string | null;
  /** 拾った原文（項目ごと）。画面では出典URLと合わせて見せる */
  raw: { employee?: string; capital?: string; representative?: string };
}

/** 「1億2,000万」「3,000万」「500万」「1億」「10,000,000」を円に */
export function parseJpYen(s: string): bigint | null {
  const t = s.normalize("NFKC").replace(/,/g, "").replace(/\s/g, "");
  let total = 0;
  let matched = false;
  const oku = t.match(/(\d+(?:\.\d+)?)億/);
  if (oku) { total += Number(oku[1]) * 1e8; matched = true; }
  const man = t.match(/(?:億)?(\d+(?:\.\d+)?)万/);
  if (man) { total += Number(man[1]) * 1e4; matched = true; }
  if (!matched) {
    const plain = t.match(/(\d{4,})/);
    if (!plain) return null;
    total = Number(plain[1]);
  }
  if (!Number.isFinite(total) || total <= 0 || total > 1e14) return null;
  return BigInt(Math.round(total));
}

export function extractProfile(text: string): CompanyProfile {
  const t = normalizeText(text);
  const out: CompanyProfile = { employeeCount: null, capital: null, representativeName: null, raw: {} };

  // 従業員数: 「従業員数 120名」「社員数：約1,200人（2025年4月現在）」「従業員 58 名」
  const emp = t.match(/(従業員数?|社員数|職員数|スタッフ数|従業員（[^）]*）)[\s:：]*(?:約|計|合計)?\s*([\d,]{1,7})\s*(名|人)/);
  if (emp) {
    const n = Number(emp[2].replace(/,/g, ""));
    if (n > 0 && n < 2_000_000) {
      out.employeeCount = n;
      out.raw.employee = emp[0].slice(0, 60);
    }
  }

  // 資本金: 「資本金 1億2,000万円」「資本金：3,000万円」「資本金 10,000,000円」
  const cap = t.match(/資本金[\s:：（(]*(?:金)?\s*([\d,\.]+\s*(?:億\s*[\d,\.]*\s*万?|万|千万|百万)?\s*円?)/);
  if (cap) {
    const yen = parseJpYen(cap[1].replace(/千万/, "000万").replace(/百万/, "00万"));
    if (yen !== null) {
      out.capital = yen;
      out.raw.capital = cap[0].slice(0, 60);
    }
  }

  // 代表者: 「代表取締役社長 山田 太郎」「代表者：佐藤花子」「理事長 鈴木一郎」
  // 役職語の直後に続く 2〜10 文字の人名らしい文字列だけを採る。
  const rep = t.match(
    /(代表取締役(?:社長|会長|CEO|副社長)?|代表者(?:名)?|代表社員|代表理事|理事長|会長|社長|院長|園長|校長|代表)[\s:：]*(?:氏名)?[\s:：]*([一-龥々]{1,5}[\s　]?[一-龥々ぁ-んァ-ヶ]{1,6})(?![一-龥])/,
  );
  if (rep) {
    const name = rep[2].replace(/\s+/g, " ").trim();
    const bad = /会社|取締|社長|株式|氏名|役員|概要|事業|所在|設立|資本|従業|電話|住所|本社|支社|代表/;
    if (name.length >= 2 && name.length <= 10 && !bad.test(name)) {
      out.representativeName = name;
      out.raw.representative = rep[0].slice(0, 60);
    }
  }

  return out;
}
