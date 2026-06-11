import { CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// カレンダー接続の完了/失敗表示（OAuthコールバックのリダイレクト先）
export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status === "ok";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
            <h1 className="mb-2 text-xl font-bold text-zinc-900">
              接続が完了しました
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              Googleカレンダーの接続が完了し、面談予約の受付が有効になりました。
              このページは閉じていただいて構いません。
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h1 className="mb-2 text-xl font-bold text-zinc-900">
              接続に失敗しました
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              お手数ですが、招待リンクからもう一度お試しください。
              解決しない場合は管理者にリンクの再発行をご依頼ください。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
