import { Plug, Unplug } from "lucide-react";
import { db } from "@/lib/db";
import { issuer, SCOPES, parseScopes } from "@/lib/oauth/server";
import { revokeMcpGrant } from "./mcp-actions";

/** 「AIと直接つなぐ」— コネクタ用URLと手順、接続中のAI一覧（解除つき） */
export async function McpConnect({ email }: { email: string }) {
  const [base, grants] = await Promise.all([
    issuer(),
    db.oAuthGrant.findMany({
      where: { userEmail: email, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, clientName: true, scope: true, createdAt: true, lastUsedAt: true },
    }),
  ]);
  const url = `${base}/api/mcp`;
  const fmt = (d: Date | null) => (d ? d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Plug className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-900">AIと直接つなぐ（コピー不要）</p>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            お使いのAIにこのURLを登録すると、材料を貼らなくてもAIが最新の材料と貴社の数字を自分で取りに来ます。ChatGPT・Claude とも同じURLです（有料プランのカスタムコネクタ機能が必要）。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="text-xs bg-[#f7f6f4] border border-zinc-200 rounded-lg px-3 py-2 text-zinc-800 select-all break-all">{url}</code>
          </div>
          <ol className="mt-3 text-xs text-zinc-700 space-y-1 leading-relaxed list-decimal list-inside">
            <li>Claude: 設定 → コネクタ → 「カスタムコネクタを追加」 → 名前「Ad Arch OS」・URLに上を貼る。ChatGPT: 設定 → コネクタ → 「作成」 → 同じURL</li>
            <li>OSのGoogleアカウントでログインし、「許可する」を押す</li>
            <li>AIに「ブランドキットの材料一覧を出して」「◯◯社向けにTVerの提案文を書いて」と頼む</li>
            <li>営業のやり取りは、AIに「◯◯社に電話した。来週提案になった」「△△は失注」と話すだけでOSに記録されます（記録者は貴社・[AI記録]の印つき）。相手先の話をする前に「◯◯社の過去のやり取りを見せて」と聞くと、グループ全社の履歴をAIが読みます</li>
          </ol>
          <p className="mt-2 text-[11px] text-zinc-500">
            AIにできること:{" "}
            {Object.values(SCOPES)
              .map((s) => s.label)
              .join("・")}
            。顧客・商談・リードはグループ全社分が見えますが、他拠点の売上・金額は見えません。営業の記録（活動・結果）はAIから貴社の記録として書けます。呼び出しは本部の記録に残ります。
          </p>
        </div>
      </div>

      {grants.length > 0 && (
        <div className="border-t border-zinc-200 pt-4">
          <p className="text-[11px] font-bold tracking-wider text-zinc-500 mb-2">接続中のAI</p>
          <ul className="divide-y divide-zinc-100">
            {grants.map((g) => (
              <li key={g.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{g.clientName ?? "AIクライアント"}</p>
                  <p className="text-[11px] text-zinc-500">
                    {parseScopes(g.scope).map((s) => SCOPES[s].label).join("・")}　／　接続 {fmt(g.createdAt)}　／　最終利用 {fmt(g.lastUsedAt)}
                  </p>
                </div>
                <form action={revokeMcpGrant}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 border border-zinc-300 rounded-lg px-3 py-1.5 hover:bg-zinc-50">
                    <Unplug className="w-3.5 h-3.5" />
                    解除
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
