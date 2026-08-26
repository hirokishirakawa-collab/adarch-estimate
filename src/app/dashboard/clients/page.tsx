import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/session";
import { loadClientRows } from "@/lib/clients/query";
import { ClientsExplorer } from "@/components/clients/clients-explorer";

export const metadata = { title: "取引先マップ" };
export const dynamic = "force-dynamic";

/**
 * 取引先マップ
 * グループ全体の取引先・制作実績あり企業を、写真つきのカードと地図・傾向グラフで見る。
 * 全代表に公開（社名・実績まで）。金額は出さない。
 */
export default async function ClientsPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const rows = await loadClientRows({
    role: info.role,
    branchIds: [info.branchId, info.branchId2].filter((b): b is string => !!b),
  });

  return <ClientsExplorer rows={rows} isAdmin={info.role === "ADMIN"} />;
}
