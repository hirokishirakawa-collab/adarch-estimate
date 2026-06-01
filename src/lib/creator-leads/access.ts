import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";

// ----------------------------------------------------------------
// クリエイター発掘AI のアクセス制御
//
// 白川代表（本部 ADMIN）専用。加盟リードと違い feature flag は付けない
// ＝パートナーには一切表示・利用させない（本部の本命候補・内部評価メモの保護）。
// ----------------------------------------------------------------

export interface CreatorAccess {
  email: string;
  name: string | null;
}

/**
 * クリエイター発掘機能へのアクセス可否を判定する。
 * ADMIN のみ許可。NGなら null を返す（呼び出し側で 403）。
 */
export async function resolveCreatorAccess(): Promise<CreatorAccess | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const role = (session.user.role ?? "USER") as UserRole;
  if (role !== "ADMIN") return null;
  return { email: session.user.email, name: session.user.name ?? null };
}
