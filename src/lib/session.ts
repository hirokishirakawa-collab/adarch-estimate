import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRole } from "@/types/roles";

/**
 * 共通セッション情報取得ユーティリティ
 * Google OAuth ログイン時に users テーブルへ upsert して userId を必ず確保する
 * role / branchId / branchId2 は DB の値を使用（管理者が設定した値を尊重）
 */
export async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;

  const email   = session.user.email ?? "";
  const jwtRole = (session.user.role ?? "MANAGER") as UserRole;

  const dbRole: "ADMIN" | "MANAGER" | "USER" =
    jwtRole === "ADMIN" ? "ADMIN" : jwtRole === "MANAGER" ? "MANAGER" : "USER";

  // 事前登録済みユーザー: update: {} で管理者設定を保持
  // 初回ログインユーザー: create で新規作成（branchId/branchId2 は未割当）
  const user = await db.user.upsert({
    where:  { email },
    update: {},
    create: {
      email,
      name:     session.user.name ?? email,
      role:     dbRole,
      branchId:  null,
      branchId2: null,
    },
    select: { id: true, name: true, role: true, branchId: true, branchId2: true },
  });

  const role      = user.role as UserRole;
  const branchId  = user.branchId  ?? null;
  const branchId2 = user.branchId2 ?? null;

  return { role, email, branchId, branchId2, userId: user.id, staffName: user.name ?? email };
}

// ---------------------------------------------------------------
// 拠点フィルタヘルパー
// ADMIN: フィルタなし
// 非ADMIN: branchId / branchId2 + 旧拠点IDの IN 句
// ---------------------------------------------------------------
type SessionInfo = NonNullable<Awaited<ReturnType<typeof getSessionInfo>>>;

// 都道府県ID → 旧拠点ID マッピング
// 顧客データが旧拠点IDで登録されているため、pref_* ユーザーでも検索できるようにする
const PREF_TO_LEGACY_BRANCH: Record<string, string> = {
  pref_kagawa:    "branch_kgo",
  pref_okayama:   "branch_kgo",
  pref_osaka:     "branch_kns",
  pref_kyoto:     "branch_kyt",
  pref_tokyo:     "branch_tk2",
  pref_chiba:     "branch_tky",
  pref_yamaguchi: "branch_ymc",
  pref_hiroshima: "branch_ymc",
  pref_kanagawa:  "branch_knw",
  pref_ibaraki:   "branch_ibk",
  pref_fukuoka:   "branch_fku",
  pref_hokkaido:  "branch_hkd",
  pref_tokushima: "branch_tks",
  pref_ishikawa:  "branch_isk",
  pref_okinawa:   "branch_okn",
  pref_saitama:   "branch_tky",
  pref_fukushima: "branch_hq",
  pref_miyagi:    "branch_hq",
  pref_shiga:     "branch_kns",
  pref_gifu:      "branch_hq",
  pref_yamanashi: "branch_hq",
};

export function getBranchFilter(info: Pick<SessionInfo, "role" | "branchId" | "branchId2">) {
  if (info.role === "ADMIN") return {};
  const base = [info.branchId, info.branchId2].filter((id): id is string => !!id);
  // pref_* に対応する旧拠点IDも追加
  const legacy = base
    .map((id) => PREF_TO_LEGACY_BRANCH[id])
    .filter((id): id is string => !!id);
  const ids = [...new Set([...base, ...legacy])];
  if (ids.length === 0) return { branchId: "__unassigned__" };
  if (ids.length === 1) return { branchId: ids[0] };
  return { branchId: { in: ids } };
}
