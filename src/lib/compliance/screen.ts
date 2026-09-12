// ==============================================================
// 受注前チェック（取引相手のスクリーニング）— 2026-09-13 代表指示
//
//   営業の件数が増えるほど、実態のない相手・闇バイト型の求人を素通しする危険が上がる。
//   新しい外部サービスは入れず、OSが既に持っているもので危険信号を出す:
//     ・法人番号（13桁＋チェックディジット。総務省の算式でオフライン判定）
//     ・gBizINFO（既存の fetchGbizProfile。設立年・資本金・従業員数・代表者名）
//     ・OS自身のデータ（同じ登記住所に何社いるか＝バーチャルオフィスの気配）
//     ・全社の営業お断りリスト（auto_sales_blacklist）
//     ・連絡先の形（固定電話が無い／サイトが無い）
//     ・求人の文言（業務内容が書けない・即日現金・秘匿アプリへの誘導）
//
//   ⚠️ ここが出すのは「信号」であって判定ではない。止める／進めるは本部が決める。
//      相手を犯罪と決めつける文言は書かない（未確認の内容を社内に残さない）。
// ==============================================================

import { db } from "@/lib/db";
import { normalizeDomain } from "@/lib/auto-sales-domain";
import { fetchGbizProfile } from "@/lib/clients/enrich";

export type ScreenLevel = "OK" | "CHECK" | "STOP";

export interface ScreenFlag {
  code: string;
  label: string;
  detail?: string;
}

export interface ScreenInput {
  name: string;
  corporateNumber?: string;
  website?: string;
  address?: string;
  phone?: string;
  /** 求人広告なら、募集内容の文面（職種・業務内容・報酬など） */
  jobText?: string;
}

export interface ScreenResult {
  level: ScreenLevel;
  name: string;
  flags: ScreenFlag[];
  profile: { foundedYear: number | null; capital: string | null; employees: number | null; representative: string | null; source: string | null } | null;
  note: string;
  next: string;
}

/** 法人番号のチェックディジット（総務省の算式）。13桁で先頭1桁が検査用数字 */
export function isValidCorporateNumber(value: string): boolean {
  const v = (value ?? "").replace(/[^0-9]/g, "");
  if (!/^\d{13}$/.test(v)) return false;
  const check = Number(v[0]);
  const body = v.slice(1); // 12桁
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    // 右から数えて奇数桁は1倍、偶数桁は2倍
    const digit = Number(body[11 - i]);
    sum += i % 2 === 0 ? digit : digit * 2;
  }
  return check === 9 - (sum % 9);
}

/** 闇バイト型の募集に出やすい言い回し。1つでは決めつけない（2つ以上で止める） */
const JOB_RED_WORDS: { re: RegExp; label: string }[] = [
  { re: /(即日|当日)[^。\n]{0,6}(現金|手渡し|支払)/, label: "即日現金・手渡し" },
  { re: /(高額|高収入|日給\s?[3-9]万|日給\s?[1-9]\d万)/, label: "相場から浮いた報酬" },
  { re: /(テレグラム|telegram|signal|シグナル|匿名性の高い)/i, label: "秘匿アプリへの誘導" },
  { re: /(受け取り|回収|運搬|運び)(のみ|だけ|作業)?[。、\s]/, label: "業務内容が「受け取り・回収・運搬」だけ" },
  { re: /(誰でも|未経験)[^。\n]{0,10}(即|すぐ|簡単)[^。\n]{0,6}(稼|高収入)/, label: "誰でもすぐ高収入" },
  { re: /(身分証|保険証|免許証)[^。\n]{0,10}(写真|画像|送っ)/, label: "身分証の画像提出を求める" },
];

/** 携帯番号しか無い＝固定の連絡先が無い */
const MOBILE_ONLY = /^(\+81\s?|0)?(70|80|90)/;

export async function screenCompany(input: ScreenInput): Promise<ScreenResult> {
  const name = input.name?.trim() || "（社名なし）";
  const flags: ScreenFlag[] = [];
  let stop = false;

  // 1) 全社の営業お断り・取引対象外リスト
  const domain = normalizeDomain(input.website ?? "");
  if (domain) {
    const blocked = await db.autoSalesBlacklist.findFirst({
      where: { domain: { in: [domain, `https://${domain}`, `http://${domain}`] } },
      select: { reason: true },
    });
    if (blocked) {
      stop = true;
      flags.push({ code: "BLOCKED", label: "全社の対象外リストに入っています", detail: blocked.reason ?? undefined });
    }
  }

  // 2) 法人番号
  const cn = (input.corporateNumber ?? "").replace(/[^0-9]/g, "");
  let profile: ScreenResult["profile"] = null;
  if (!cn) {
    flags.push({ code: "NO_CORP_NUMBER", label: "法人番号が分かっていません", detail: "国税庁の法人番号公表サイトで社名から引けます" });
  } else if (!isValidCorporateNumber(cn)) {
    flags.push({ code: "BAD_CORP_NUMBER", label: "法人番号の桁が合っていません（13桁の検査に不合格）", detail: cn });
  } else {
    const token = process.env.GBIZINFO_API_TOKEN ?? "";
    const hit = token ? await fetchGbizProfile(cn, token).catch(() => null) : null;
    if (!hit) {
      flags.push({ code: "NOT_IN_GBIZ", label: "gBizINFOに情報がありません", detail: "行政との取引が無い会社は載らないため、これだけでは判断しません" });
    } else {
      profile = {
        foundedYear: hit.foundedYear,
        capital: hit.capital != null ? `${hit.capital.toString()}円` : null,
        employees: hit.employeeCount,
        representative: hit.representativeName,
        source: hit.sourceUrl,
      };
      const thisYear = new Date().getFullYear();
      if (hit.foundedYear && thisYear - hit.foundedYear < 1) {
        flags.push({ code: "NEW_COMPANY", label: `設立して間もない会社です（${hit.foundedYear}年）` });
      }
    }
  }

  // 3) 同じ住所にOSの他社が何件いるか（バーチャルオフィスの気配）
  const addr = (input.address ?? "").trim();
  if (addr.length >= 8) {
    const key = addr.replace(/\s+/g, "").slice(0, 24);
    const [sameCustomers, sameLeads] = await Promise.all([
      db.customer.count({ where: { address: { contains: key }, NOT: { name } } }),
      db.lead.count({ where: { address: { contains: key }, NOT: { name } } }),
    ]);
    const total = sameCustomers + sameLeads;
    if (total >= 3) {
      flags.push({ code: "SHARED_ADDRESS", label: `同じ住所にOS上で他に${total}社あります`, detail: "貸し住所・シェアオフィスの可能性。所在の確認を" });
    }
  }

  // 4) 連絡先の形
  if (!input.website?.trim()) {
    flags.push({ code: "NO_SITE", label: "自社サイトがありません" });
  }
  const phone = (input.phone ?? "").replace(/[\s-]/g, "");
  if (phone && MOBILE_ONLY.test(phone)) {
    flags.push({ code: "MOBILE_ONLY", label: "連絡先が携帯番号だけです" });
  }

  // 5) 求人の文言
  if (input.jobText?.trim()) {
    const hits = JOB_RED_WORDS.filter((w) => w.re.test(input.jobText!));
    for (const h of hits) flags.push({ code: "JOB_WORD", label: `求人の文言: ${h.label}` });
    if (hits.length >= 2) stop = true;
  }

  const level: ScreenLevel = stop ? "STOP" : flags.length > 0 ? "CHECK" : "OK";
  return {
    level,
    name,
    flags,
    profile,
    note:
      level === "STOP"
        ? "このまま進めず、本部の判断を仰いでください"
        : level === "CHECK"
          ? "気になる点があります。受注前に確かめてください（信号であって、黒という意味ではありません）"
          : "気になる点は見つかりませんでした",
    next:
      level === "OK"
        ? "通常どおり進めて問題ありません。支払いは法人名義の口座からの振込にしてください"
        : "確かめる順: ①国税庁の法人番号公表サイトで社名と所在地が一致するか ②登記の住所に会社の表示があるか ③求人なら業務内容・就業場所・賃金が具体的に書けるか。判断に迷ったら ask_hq で本部へ",
  };
}
