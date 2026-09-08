import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SCOPES } from "@/lib/oauth/server";
import { decideAuthorize, validateAuthorizeRequest } from "./actions";

export const metadata = { title: "AIとの連携を許可 | Ad Arch OS" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f6f4] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px] bg-white border border-zinc-200 rounded-2xl p-8">
        <Image src="/logo-adarch.png" alt="Ad Arch Group" width={160} height={32} className="h-7 w-auto mb-8" />
        {children}
      </div>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<SP> }) {
  const raw = await searchParams;
  const sp = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, one(v)])) as Record<string, string | undefined>;

  if (sp.error) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-zinc-900">連携できませんでした</h1>
        <p className="text-sm text-zinc-600 mt-3 leading-relaxed">{sp.error}</p>
      </Shell>
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }

  const v = await validateAuthorizeRequest(sp);
  if (!v.ok) {
    return (
      <Shell>
        <h1 className="text-lg font-bold text-zinc-900">連携できませんでした</h1>
        <p className="text-sm text-zinc-600 mt-3 leading-relaxed">{v.reason}</p>
      </Shell>
    );
  }

  const clientName = v.client.name ?? "AIクライアント";
  return (
    <Shell>
      <p className="text-[11px] font-semibold tracking-[3px] uppercase text-zinc-400 mb-3">Connect</p>
      <h1 className="text-lg font-bold text-zinc-900 leading-snug">
        <span className="text-orange-600">{clientName}</span> が Ad Arch OS に接続しようとしています
      </h1>
      <p className="text-xs text-zinc-500 mt-2">
        ログイン中: <span className="font-semibold text-zinc-700">{session.user.email}</span>
      </p>

      <div className="mt-6 border-t border-zinc-900 pt-4 space-y-3">
        <p className="text-xs font-bold text-zinc-900">許可すると、このAIは貴社の代理で次のことができます</p>
        <ul className="space-y-2">
          {v.scopes.map((s) => (
            <li key={s} className="text-sm text-zinc-700 leading-relaxed">
              <span className="font-semibold text-zinc-900">{SCOPES[s].label}</span>
              <span className="block text-xs text-zinc-500 mt-0.5">{SCOPES[s].desc}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          見えるのは、OSで貴社が見られる範囲だけです。AIからの呼び出しは本部の記録に残ります。接続はブランドキットの画面からいつでも解除できます。
        </p>
      </div>

      <form action={decideAuthorize} className="mt-7 flex gap-2">
        <input type="hidden" name="client_id" value={v.client.id} />
        <input type="hidden" name="redirect_uri" value={v.redirectUri} />
        <input type="hidden" name="state" value={v.state} />
        <input type="hidden" name="code_challenge" value={v.codeChallenge} />
        <input type="hidden" name="scope" value={v.scopes.join(" ")} />
        <button
          type="submit"
          name="decision"
          value="approve"
          className="flex-1 bg-zinc-900 text-white text-sm font-bold py-3 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          許可する
        </button>
        <button
          type="submit"
          name="decision"
          value="deny"
          className="px-5 border border-zinc-300 text-zinc-700 text-sm font-semibold rounded-xl hover:bg-zinc-50 transition-colors"
        >
          やめる
        </button>
      </form>
    </Shell>
  );
}
