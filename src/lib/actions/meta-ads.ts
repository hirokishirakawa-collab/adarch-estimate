"use server";

// ==============================================================
// Meta広告アカウントの接続（拠点ごと）— /dashboard/meta-ads
//   保存時に接続テスト（広告アカウント名・通貨・ページ名を取得）。失敗＝トークンかIDが違う
//   MANAGER以上。拠点未割当のユーザーは作れない。本部は branchId=null の自分用
// ==============================================================

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireSession, branchIdForNewAccount } from "@/lib/line/access";
import { encryptMetaToken, normalizeAdAccountId, verifyMetaAccess } from "@/lib/meta-ads/account";

type Result = { error?: string; ok?: boolean; message?: string };
const BASE = "/dashboard/meta-ads";
const str = (fd: FormData, k: string) => ((fd.get(k) as string) ?? "").trim();

export async function saveMetaAdAccount(_prev: Result | null, fd: FormData): Promise<Result> {
  let info;
  try {
    info = await requireSession();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (info.role === "USER") return { error: "接続は代表（MANAGER以上）のみ行えます" };
  const branchId = branchIdForNewAccount(info);
  if (branchId === undefined) return { error: "拠点が割り当てられていないアカウントでは接続できません" };

  const name = str(fd, "name") || (info.role === "ADMIN" ? "本部" : "自拠点");
  const adAccountId = str(fd, "adAccountId");
  const pageId = str(fd, "pageId");
  const accessToken = str(fd, "accessToken");
  if (!adAccountId || !pageId) return { error: "広告アカウントID（act_…）とFacebookページIDを入れてください" };

  const existing = await db.metaAdAccount.findFirst({ where: { branchId } });
  if (!existing && !accessToken) return { error: "アクセストークンを入れてください（システムユーザーのトークン・ads_management 権限）" };

  try {
    const token = accessToken || (existing ? (await import("@/lib/line/secret")).decryptSecret(existing.accessTokenEnc) : "");
    const v = await verifyMetaAccess(token, adAccountId, pageId); // ここで失敗＝設定が違う
    const data = {
      name,
      adAccountId: normalizeAdAccountId(adAccountId),
      pageId,
      adAccountName: v.adAccountName,
      currency: v.currency,
      isActive: true,
      lastVerifiedAt: new Date(),
      createdByEmail: info.email,
      ...(accessToken ? { accessTokenEnc: encryptMetaToken(accessToken) } : {}),
    };
    if (existing) {
      await db.metaAdAccount.update({ where: { id: existing.id }, data });
    } else {
      await db.metaAdAccount.create({ data: { ...data, branchId, accessTokenEnc: encryptMetaToken(accessToken) } });
    }
    logAudit({ action: "meta_ads_connected", email: info.email, entity: "meta_ad_account", entityId: branchId ?? "hq", detail: `${v.adAccountName}（${v.currency}）／ページ: ${v.pageName}` });
    revalidatePath(BASE);
    return { ok: true, message: `接続できました: ${v.adAccountName}（${v.currency}）／ページ「${v.pageName}」` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "接続テストに失敗しました" };
  }
}

export async function disconnectMetaAdAccount(): Promise<Result> {
  let info;
  try {
    info = await requireSession();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const branchId = branchIdForNewAccount(info);
  if (branchId === undefined) return { error: "権限がありません" };
  const row = await db.metaAdAccount.findFirst({ where: { branchId } });
  if (!row) return { ok: true };
  await db.metaAdAccount.delete({ where: { id: row.id } });
  logAudit({ action: "meta_ads_disconnected", email: info.email, entity: "meta_ad_account", entityId: branchId ?? "hq", detail: row.name });
  revalidatePath(BASE);
  return { ok: true, message: "接続を解除しました" };
}
