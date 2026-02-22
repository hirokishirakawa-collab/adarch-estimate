// ============================================================
// ロール定義 v2 — Ad-Arch Group OS 権限体系
// ============================================================
//
// 【ロール一覧】
//   ADMIN   : 本部
//             グループ全体の全データ（全拠点の財務・売上・案件）へのフルアクセス。
//             ロールの割り当ても本部が手動で実施する。
//
//   MANAGER : 代表（加盟拠点の責任者）
//             財務・売上データは「自拠点のみ」閲覧可能。
//             実務ツールは全て利用可能。
//
//   USER    : 一般社員（拠点所属）
//             実務ツールのみ利用可能。
//             財務・売上データへのアクセスは一切不可。
//
// 【Phase 2 以降】
//   DB に users テーブルを作成し、role と branchId を管理する。
//   本部（ADMIN）が管理画面から手動でロールを割り振る。
// ============================================================

export type UserRole = "ADMIN" | "MANAGER" | "USER";

/** ロールの強さ（数値が大きいほど上位） */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 3,
  MANAGER: 2,
  USER: 1,
};

/**
 * ユーザーが必要なロール以上の権限を持つか判定
 * @example hasMinRole("MANAGER", "USER") → true
 */
export function hasMinRole(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * 財務・売上データへのアクセス可否
 *
 *   ADMIN   → 全拠点のデータにアクセス可
 *   MANAGER → 自拠点のデータのみ (Phase 2 で branchId フィルタリング実装)
 *   USER    → アクセス不可
 */
export function canAccessFinance(role: UserRole): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * 特定拠点のデータのみに制限すべきか
 *   ADMIN は全拠点なので false
 *   MANAGER/USER は自拠点のみなので true
 */
export function isBranchScoped(role: UserRole): boolean {
  return role !== "ADMIN";
}

// ============================================================
// ユーザーコンテキスト型（Phase 2 で DB から取得する想定）
// ============================================================

/**
 * ログインユーザーの完全なコンテキスト
 *
 * Phase 1: role のみ使用（JWT から取得）
 * Phase 2: branchId も DB から取得し、データフィルタリングに使用
 */
export interface UserContext {
  /** ユーザーID（Google sub または DB の UUID） */
  userId: string;

  /** ロール（本部が手動割り当て） */
  role: UserRole;

  /**
   * 所属拠点 ID
   * - ADMIN（本部）: null → 全拠点アクセス
   * - MANAGER/USER : 所属拠点の ID（例: "branch_tokyo", "branch_osaka"）
   */
  branchId: string | null;
}

// ============================================================
// ルートごとの最小必要ロール定義
// ============================================================
export const ROUTE_ROLE_MAP: Record<string, UserRole> = {
  // 管理者専用
  "/admin": "ADMIN",

  // 財務・売上 → MANAGER以上（MANAGERは自拠点のみ、Phase 2でbranchIdフィルタ）
  "/sales-report": "MANAGER",

  // 全員アクセス可能
  "/dashboard": "USER",
  "/customers": "USER",
  "/deals": "USER",
  "/projects": "USER",
  "/estimates": "USER",
  "/group-sync": "USER",
  "/billing": "USER",
  "/legal": "USER",
  "/training": "USER",
  "/business-cards": "USER",
  "/media": "USER",
  "/gemini": "USER",
  "/sales-tools": "USER",
};
