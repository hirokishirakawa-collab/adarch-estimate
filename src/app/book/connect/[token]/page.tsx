import { notFound } from "next/navigation";
import { CalendarCheck, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ホスト向け カレンダー接続ページ（招待リンクから開く・認証不要）
export default async function ConnectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{32,64}$/.test(token)) notFound();

  const host = await db.bookingHost.findUnique({
    where: { connectToken: token },
  });
  if (!host || !host.isActive) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-xs font-semibold tracking-widest text-blue-600">
          AD ARCH 予約システム
        </p>
        <CalendarCheck className="mx-auto mb-4 h-12 w-12 text-blue-600" />
        <h1 className="mb-2 text-xl font-bold text-zinc-900">
          {host.name} 様
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-zinc-600">
          面談予約の受付を始めるため、Googleカレンダーを接続してください。
          接続は一度だけで完了します。
        </p>

        {host.connectedAt && (
          <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            接続済みです（{host.googleEmail ?? "Googleアカウント"}）。
            再接続する場合は下のボタンからやり直せます。
          </div>
        )}

        <a
          href={`/api/book/oauth/start?token=${token}`}
          className="block w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Googleカレンダーを接続する
        </a>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-zinc-50 px-4 py-3 text-left text-xs leading-relaxed text-zinc-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <span>
            取得するのは「空き時間の照会」と「面談予定の作成」の権限のみです。
            既存のご予定の内容（タイトルや参加者）がAd Archに共有されることはありません。
          </span>
        </div>
      </div>
    </div>
  );
}
