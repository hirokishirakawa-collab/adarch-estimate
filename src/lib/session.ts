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
  // pref_saitama は対応なし: branch_tky は千葉（片桐さん）の旧拠点。埼玉とは見合わない（2026-09-17 代表決定）
  pref_fukushima: "branch_hq",
  pref_miyagi:    "branch_hq",
  pref_shiga:     "branch_kns",
  pref_gifu:      "branch_hq",
  pref_yamanashi: "branch_hq",
};

// ---------------------------------------------------------------
// 自拠点に閉じる画面（案件・見積・レギュラー・金額）の判定（2026-09-17 代表指示）
//   本部＝全部、代表＝自分の拠点だけ。拠点はコードの固定表ではなくDBの所属（users.branchId / branchId2）で決める。
//   ⚠️ 旧拠点の対応表では山梨・福島・宮城・岐阜が branch_hq に寄せてある。そのまま使うと
//      本部の案件が見えてしまうので、対応表から来た branch_hq は含めない（本人の所属が本部のときだけ含む）。
//   ⚠️ 所属が無い人は「全部」ではなく「何も見えない」にする。
// ---------------------------------------------------------------
const HQ_BRANCH_ID = "branch_hq";

export function ownBranchIds(info: Pick<SessionInfo, "role" | "branchId" | "branchId2">): string[] {
  const base = [info.branchId, info.branchId2].filter((id): id is string => !!id);
  const legacy = base
    .map((id) => PREF_TO_LEGACY_BRANCH[id])
    .filter((id): id is string => !!id && id !== HQ_BRANCH_ID);
  return [...new Set([...base, ...legacy])];
}

/** Prisma の where に混ぜる拠点条件。本部は {}、所属なしは一致しない条件 */
export function ownBranchWhere(info: Pick<SessionInfo, "role" | "branchId" | "branchId2">) {
  if (info.role === "ADMIN") return {};
  const ids = ownBranchIds(info);
  if (ids.length === 0) return { branchId: "__unassigned__" };
  if (ids.length === 1) return { branchId: ids[0] };
  return { branchId: { in: ids } };
}

/** その拠点のデータを見てよいか（金額の表示・編集可否など） */
export function canSeeBranch(info: Pick<SessionInfo, "role" | "branchId" | "branchId2">, branchId: string | null | undefined): boolean {
  if (info.role === "ADMIN") return true;
  return !!branchId && ownBranchIds(info).includes(branchId);
}

/** 新しく作る記録の拠点。本部はその本人の所属（無ければ branch_hq）、代表は所属が無ければ null＝作らせない */
export function createBranchId(info: Pick<SessionInfo, "role" | "branchId">): string | null {
  if (info.branchId) return info.branchId;
  return info.role === "ADMIN" ? HQ_BRANCH_ID : null;
}

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
