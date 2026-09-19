// ==============================================================
// Ad Arch Studio — 問い合わせの振り分け（内部だけ。外には「アドアーチ」としか出さない）
//   1. 迷惑の疑い → 本部の一覧だけ（県本部には回さない）
//   2. 撮影地の県 → 無ければ会社の所在県 → 県の担当表（StudioPrefectureAssignment）
//      2社いる県（茨城・埼玉）は順番（最後に割り当てた日が古い方）
//   3. 担当がいない → 本部の一覧（本部が近くの県本部か登録クリエイターに振る）
//   ⚠️ 顧客データ（Customer）は読まない（2026-09-19 代表決定＝既存客は本部が付け替える）
// ==============================================================

import { db } from "@/lib/db";
import { PREFECTURES as PREFS, toFullPrefecture } from "@/lib/constants/crm";

const PREFECTURES = (PREFS as readonly string[]).filter((p) => p !== "海外");

export interface Route {
  groupCompanyId: string | null;
  branchId: string | null;
  reason: string;
}

/** 自由記述から県名をそろえる（「香川」「香川県」→「香川県」）。一致しなければ null */
export function normalizePrefecture(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const full = toFullPrefecture(t);
  if (PREFECTURES.includes(full)) return full;
  // 「高松市」のように市だけ書かれた場合は県名を含む時だけ拾う
  const hit = PREFECTURES.find((p) => t.includes(p.replace(/[都道府県]$/, "")));
  return hit ?? null;
}

export async function routeInquiry(input: { locationPrefecture: string | null; prefecture: string | null; suspectedSpam: boolean }): Promise<Route> {
  if (input.suspectedSpam) return { groupCompanyId: null, branchId: null, reason: "迷惑の疑い（本部で確認）" };
  const pref = input.locationPrefecture ?? input.prefecture;
  if (!pref) return { groupCompanyId: null, branchId: null, reason: "県が不明（本部で振り分け）" };

  // 同時に来ても同じ社に偏らないよう、選ぶ→更新を1つのトランザクションで
  return db.$transaction(async (tx) => {
    const rows = await tx.studioPrefectureAssignment.findMany({
      where: { prefecture: pref, active: true },
      orderBy: [{ lastAssignedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    });
    if (rows.length === 0) return { groupCompanyId: null, branchId: null, reason: `${pref}は担当なし（本部で振り分け）` };
    const pick = rows[0];
    await tx.studioPrefectureAssignment.update({ where: { id: pick.id }, data: { lastAssignedAt: new Date() } });
    return {
      groupCompanyId: pick.groupCompanyId,
      branchId: pick.branchId,
      reason: rows.length > 1 ? `${pref}（${rows.length}社の順番）` : pref,
    };
  });
}
