import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * 同意のあと、AIクライアントの redirect_uri へ戻す中継ページ。
 * CSP の form-action 'self' により、フォーム送信からの外部リダイレクトはブラウザが止めるため、
 * 同一オリジンで1枚描いてから meta refresh とリンクで飛ばす。
 * 戻り先は登録済み redirect_uri と一致するものだけ（オープンリダイレクト防止）。
 */
export default async function AuthorizeDonePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const clientId = one(sp.client_id);
  const redirectUri = one(sp.redirect_uri);
  const client = clientId ? await db.oAuthClient.findUnique({ where: { id: clientId }, select: { name: true, redirectUris: true } }) : null;
  const ok = !!client && client.redirectUris.includes(redirectUri);

  if (!ok) {
    return (
      <div className="min-h-screen bg-[#f7f6f4] flex items-center justify-center px-6">
        <p className="text-sm text-zinc-700">戻り先が確認できませんでした。AI側でコネクタを登録し直してください。</p>
      </div>
    );
  }

  const u = new URL(redirectUri);
  for (const k of ["code", "state", "error"]) {
    const v = one(sp[k]);
    if (v) u.searchParams.set(k, v);
  }
  const target = u.toString();
  const denied = !!one(sp.error);

  return (
    <div className="min-h-screen bg-[#f7f6f4] flex items-center justify-center px-6">
      <meta httpEquiv="refresh" content={`0;url=${target}`} />
      <div className="w-full max-w-[440px] bg-white border border-zinc-200 rounded-2xl p-8 text-center">
        <p className="text-sm font-bold text-zinc-900">{denied ? "接続をやめました" : `${client!.name ?? "AI"} に戻ります…`}</p>
        <p className="text-xs text-zinc-500 mt-2">
          自動で戻らない場合は{" "}
          <a href={target} className="underline text-zinc-800">
            こちら
          </a>
          。このタブは閉じて構いません。
        </p>
      </div>
    </div>
  );
}
