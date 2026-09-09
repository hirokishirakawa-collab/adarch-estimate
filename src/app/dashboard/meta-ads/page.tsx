// ==============================================================
// /dashboard/meta-ads — 拠点のMeta広告アカウントをOSにつなぐ（MANAGER以上）
//   出稿は各拠点のアカウント・費用・責任で。本部は接続状況（件数）だけ見える
//   つなぐと、AIに「唐津市に日額500円で7日、このLPへ」と言えば地域限定広告が作れる（create_local_ad）
// ==============================================================
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { branchIdForNewAccount } from "@/lib/line/access";
import { MetaConnectForm } from "@/components/meta-ads/connect-form";

export const metadata = { title: "Meta広告（地域限定）" };
export const dynamic = "force-dynamic";

export default async function MetaAdsPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");
  if (info.role === "USER") redirect("/dashboard");
  const branchId = branchIdForNewAccount(info);
  const mine = branchId === undefined ? null : await db.metaAdAccount.findFirst({ where: { branchId } });
  const branches = info.role === "ADMIN" ? await db.metaAdAccount.findMany({ where: { branchId: { not: null } }, include: { branch: { select: { name: true } } }, orderBy: { createdAt: "asc" } }) : [];
  const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—");

  return (
    <div className="px-6 py-6 max-w-screen-lg mx-auto w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <Megaphone className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Meta広告（地域限定）— 貴社の広告アカウントをOSにつなぐ</h2>
          <p className="text-xs text-zinc-500 mt-0.5">つなぐと、AIに「◯◯市に日額500円で7日、このLPへ」と言うだけで、Facebook／Instagramの地域限定広告が作れます。出稿・費用・運用は貴社のアカウントで行います（本部は関与しません）</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        {mine && (
          <p className="text-sm text-zinc-700 mb-4">
            接続中: <b>{mine.adAccountName ?? mine.adAccountId}</b>（{mine.currency ?? "—"}）／ページID {mine.pageId} ／ 最終確認 {fmt(mine.lastVerifiedAt)}
          </p>
        )}
        {branchId === undefined ? (
          <p className="text-sm text-rose-700">拠点が割り当てられていないため接続できません。本部にお問い合わせください。</p>
        ) : (
          <MetaConnectForm existing={mine ? { name: mine.name, adAccountId: mine.adAccountId, pageId: mine.pageId } : null} />
        )}
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-sm text-zinc-700 space-y-2">
        <p className="font-semibold">用意するもの（Meta Business Suite）</p>
        <ol className="list-decimal pl-5 space-y-1 text-[13px]">
          <li>広告アカウントID（広告マネージャ → 設定。「act_」で始まる番号）</li>
          <li>広告の名義になる Facebookページ のID</li>
          <li>アクセストークン＝ビジネス設定 → システムユーザー → トークンを生成（権限: ads_management・pages_read_engagement）。広告アカウントとページへのアクセス権をそのシステムユーザーに付ける</li>
        </ol>
        <p className="text-[13px]">つないだ後の使い方: AIに「唐津市に日額500円で7日、さっきのLPへ広告を出して」。作成は「停止」状態＝内容を広告マネージャで確認して配信をONに（「最初からON」と言えばそのまま配信）。バナーはOSの数字で描いた型（市のTVer視聴者数・届く人数・月額目安）が入ります。</p>
      </div>

      {info.role === "ADMIN" && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-100 bg-zinc-50"><p className="text-xs font-semibold text-zinc-600">拠点の接続状況（本部は件数と接続の有無だけ・広告の中身は見ない）</p></div>
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] text-zinc-500 border-b border-zinc-100"><th className="px-4 py-2 text-left font-semibold">拠点</th><th className="px-4 py-2 text-left font-semibold">表示名</th><th className="px-4 py-2 text-left font-semibold">通貨</th><th className="px-4 py-2 text-right font-semibold">最終確認</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {branches.length === 0 && <tr><td colSpan={4} className="px-4 py-5 text-center text-xs text-zinc-400">まだ接続した拠点はありません</td></tr>}
              {branches.map((b) => (
                <tr key={b.id}><td className="px-4 py-2">{b.branch?.name ?? "—"}</td><td className="px-4 py-2">{b.name}</td><td className="px-4 py-2">{b.currency ?? "—"}</td><td className="px-4 py-2 text-right text-xs text-zinc-500">{fmt(b.lastVerifiedAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
