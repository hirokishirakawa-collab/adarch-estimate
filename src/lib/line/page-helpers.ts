// 各アカウント配下ページ共通：権限チェック＋ヘッダ用データ
import { notFound, redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/session";
import { getManageableAccount } from "@/lib/line/access";

export async function loadAccountPage(accountId: string) {
  const info = await getSessionInfo();
  if (!info) redirect("/login");
  const account = await getManageableAccount(info, accountId);
  if (!account) notFound();
  return { info, account };
}
