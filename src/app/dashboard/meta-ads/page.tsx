// ==============================================================
// /dashboard/meta-ads — Meta広告（地域限定）のつなぎ方と、記録した広告の一覧（MANAGER以上）
//   出稿は各拠点のアカウント・費用・責任で
//   2026-09-18〜 作成はAI↔Meta公式コネクタ（mcp.facebook.com/ads）。OSは設計（create_local_ad）と記録（record_local_ad）＝この画面は「つなぎ方」と「記録した広告」
// ==============================================================
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { getSessionInfo } from "@/lib/session";
import { listLocalAdRecords } from "@/lib/meta-ads/records";
import { CopyTextButton } from "@/components/packages/copy-text-button";

const META_MCP_URL = "https://mcp.facebook.com/ads";
const ASK_EXAMPLE = "OSで◯◯県◯◯市の地域限定広告の設計を出して、その位置を使って、Metaで◯◯市の中心から半径10km・日額500円・7日間・（LPのURL）・（画像のURL）の広告を停止中で作って。作ったらプレビューを見せて";

export const metadata = { title: "Meta広告（地域限定）" };
export const dynamic = "force-dynamic";

export default async function MetaAdsPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");
  if (info.role === "USER") redirect("/dashboard");
  const records = await listLocalAdRecords({ role: info.role, branchId: info.branchId ?? null });

  return (
    <div className="px-6 py-6 max-w-screen-lg mx-auto w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <Megaphone className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Meta広告（地域限定）— AIとMetaをつなぐ</h2>
          <p className="text-xs text-zinc-500 mt-0.5">お使いのAIにMeta公式コネクタをつなぐと、OSで出した市の設計を使って、貴社の広告アカウントに広告を作れます（作成は停止中・配信ONは本人・広告費は貴社）。</p>
        </div>
      </div>

      {/* 2026-09-18 Meta公式の広告コネクタ（MCP）で作成まで確認＝アプリ・トークン不要。各社はこちらを案内する */}
      <div className="bg-white border border-orange-200 rounded-xl p-5 space-y-3">
        <div>
          <p className="text-sm font-bold text-zinc-900">つなぎ方：Meta公式コネクタ（アプリ・トークン不要）</p>
          <p className="text-xs text-zinc-500 mt-0.5">お使いのAI（Claude／ChatGPT）に、Metaが公式に出している広告コネクタを足すだけです。つなぐと、AIから貴社の広告アカウントで広告を作れます（作成は停止中・配信ONは本人）。</p>
        </div>
        <ol className="list-decimal pl-5 space-y-1.5 text-[13px] text-zinc-700">
          <li><b>Claude</b>：claude.ai の「設定」→「コネクタ」→「カスタムコネクタを追加」。名前は「Meta Ads」、URLは下のもの。<b>ChatGPT</b>：設定の「コネクタ」から同じURLを追加</li>
          <li>「連携／接続」→ Metaのログインと許可の画面で、<b>貴社のビジネス</b>と<b>広告アカウント</b>を選んで許可する（Claude Codeを開いたままつないだ場合は、開き直すと使えます）</li>
          <li>AIに「Metaで使える広告アカウントを一覧にして」と頼み、貴社の広告アカウントが出ればOK</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-[13px] bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1">{META_MCP_URL}</code>
          <CopyTextButton text={META_MCP_URL} label="URLをコピー" />
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-zinc-700">つないだ後の頼み方（OSとMetaの両方をつないだ状態）</p>
          <p className="text-[13px] text-zinc-700">{ASK_EXAMPLE}</p>
          <CopyTextButton text={ASK_EXAMPLE} label="頼み方をコピー" />
          <p className="text-[12px] text-zinc-500">市の中心の位置はOSが出します。画像はネット上で見られるPNG/JPGのURLを渡すか、AIにアップロードしてもらいます。広告費・運用は貴社のアカウントです。</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs font-semibold text-zinc-600">記録した広告（{info.role === "ADMIN" ? "全社" : "自拠点"}）— AIが作った後に record_local_ad で残した分。成果はAIに「広告の結果を見て」と頼むと書き足されます</p>
        </div>
        {records.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-zinc-400">まだ記録された広告はありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-zinc-500 border-b border-zinc-100">
                  <th className="px-4 py-2 text-left font-semibold">画像</th>
                  <th className="px-4 py-2 text-left font-semibold">市・拠点</th>
                  <th className="px-4 py-2 text-left font-semibold">見出し</th>
                  <th className="px-4 py-2 text-left font-semibold">期間</th>
                  <th className="px-4 py-2 text-right font-semibold">表示</th>
                  <th className="px-4 py-2 text-right font-semibold">クリック</th>
                  <th className="px-4 py-2 text-right font-semibold">クリック率</th>
                  <th className="px-4 py-2 text-left font-semibold">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      {/* 画像は各社のドメインにあり、OSのCSP（img-src）で縮小表示できない＝リンクで開く */}
                      {r.imageUrl ? (
                        <a href={r.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-700 underline whitespace-nowrap">画像を開く</a>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.area}
                      <span className="block text-[11px] text-zinc-500">{r.branch}{r.industry ? `・${r.industry}` : ""}</span>
                    </td>
                    <td className="px-4 py-2 min-w-[14rem]">{r.headline}</td>
                    <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">{r.period ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.impressions?.toLocaleString("ja-JP") ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.clicks?.toLocaleString("ja-JP") ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.ctrPct != null ? `${r.ctrPct}%` : "—"}</td>
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {r.status === "ACTIVE" ? "配信中" : r.status === "ENDED" ? "終了" : "停止中"}
                      {r.resultsUpdatedAt && <span className="block text-[11px] text-zinc-400">成果 {r.resultsUpdatedAt}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
