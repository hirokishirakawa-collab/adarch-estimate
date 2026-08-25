import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { addFriendUrl } from "@/lib/line/format";
import { qrSvg } from "@/lib/line/qr";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------
// スライド投影・印刷用の大きなQR（白地・余計なUIなし）
// ---------------------------------------------------------------
export default async function EntryPointQrPage({ params }: { params: Promise<{ accountId: string; id: string }> }) {
  const { accountId, id } = await params;
  const { account } = await loadAccountPage(accountId);
  const ep = await db.lineEntryPoint.findFirst({ where: { id, accountId } });
  if (!ep) notFound();
  const url = addFriendUrl(account.basicId);
  if (!url) notFound();
  const svg = await qrSvg(url, 560);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 p-10 print:p-0">
      <p className="text-2xl font-bold text-zinc-900 text-center">{account.botDisplayName ?? account.name}</p>
      <div className="w-[min(70vh,560px)] h-[min(70vh,560px)] [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-lg text-zinc-700 text-center">LINEで友だち追加</p>
      <p className="text-sm text-zinc-400 text-center print:hidden">{ep.name} ・ このページはそのままスライドに映すか、ブラウザの印刷でPDFにできます</p>
    </div>
  );
}
