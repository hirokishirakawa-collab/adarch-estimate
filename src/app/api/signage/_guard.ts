// サイネージCMS API 共通ガード: MANAGER以上・拠点スコープ
import { NextResponse } from "next/server";
import { getSessionInfo, getBranchFilter } from "@/lib/session";

export async function requireSignageUser() {
  const info = await getSessionInfo();
  if (!info || info.role === "USER") return { error: new NextResponse("Unauthorized", { status: 401 }), info: null };
  return { error: null, info };
}

export type SignageSession = NonNullable<Awaited<ReturnType<typeof requireSignageUser>>["info"]>;

/** 拠点スコープの where（ADMINは全件） */
export function scope(info: SignageSession) {
  return getBranchFilter(info);
}

/** 新規作成時の branchId（ADMINは指定 or null=本部、代表は自拠点固定） */
export function branchIdForCreate(info: SignageSession, requested?: string | null): string | null {
  if (info.role === "ADMIN") return requested ?? null;
  return info.branchId ?? null;
}
