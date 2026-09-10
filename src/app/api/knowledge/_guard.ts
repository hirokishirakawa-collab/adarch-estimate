// 資料ライブラリ API 共通ガード
//   読む・聞く: ログイン済み全員（hqOnly は ADMIN だけ）
//   登録・編集・削除・やり直し: ADMIN（本部＝代表1人）だけ。画面を迂回してもここで止まる
import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/session";

export async function requireReader() {
  const info = await getSessionInfo();
  if (!info) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), info: null };
  return { error: null, info };
}

export async function requireAdmin() {
  const info = await getSessionInfo();
  if (!info) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), info: null };
  if (info.role !== "ADMIN") return { error: NextResponse.json({ error: "この操作は本部のみです" }, { status: 403 }), info: null };
  return { error: null, info };
}
