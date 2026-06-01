import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";

// ----------------------------------------------------------------
// 加盟リード獲得AI のアクセス制御
//
// 利用できるのは:
//   - ADMIN（本部）            … 全リードを閲覧・編集可
//   - enabledFeatures に "franchise-leads" を持つユーザー（例: 開拓パートナーの一村さん）
//       … 自分が担当（ownerEmail = 自分のメール）のリードのみ閲覧・編集可
//
// 非ADMINに全リードを見せない（本部の本命候補・内部評価メモの漏洩防止）ため、
// 一覧取得・更新・削除では ownerScope を必ず WHERE 条件に効かせること。
// ----------------------------------------------------------------

export const FRANCHISE_LEADS_FEATURE = "franchise-leads";

export interface FranchiseAccess {
  email: string;
  name: string | null;
  isAdmin: boolean;
  /**
   * 自分のリードのみに絞る WHERE 断片。
   * ADMIN は {}（全件）、非ADMIN は { ownerEmail } を返す。
   * findMany / updateMany / deleteMany の where に展開して使う。
   */
  ownerScope: Record<string, never> | { ownerEmail: string };
}

/**
 * 加盟リード機能へのアクセス可否を判定する。
 * 認可OKなら FranchiseAccess を、NGなら null を返す（呼び出し側で 403 を返す）。
 */
export async function resolveFranchiseAccess(): Promise<FranchiseAccess | null> {
  const session = await auth();
  if (!session?.user?.email) return null;

  const role = (session.user.role ?? "USER") as UserRole;
  const features = session.user.enabledFeatures ?? [];
  const isAdmin = role === "ADMIN";
  const hasFeature = features.includes(FRANCHISE_LEADS_FEATURE);

  if (!isAdmin && !hasFeature) return null;

  const email = session.user.email;
  return {
    email,
    name: session.user.name ?? null,
    isAdmin,
    ownerScope: isAdmin ? {} : { ownerEmail: email },
  };
}
