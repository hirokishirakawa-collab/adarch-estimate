import Link from "next/link";
import { Tv2, ArrowLeft, FileDown, Clock } from "lucide-react";
import { getTverFlyerById } from "@/lib/actions/tver-flyer";
import { buildFlyerData } from "@/lib/tver/flyer-data";
import { getFlyerStatusOption, TVER_FLYER_TEMPLATES } from "@/lib/constants/tver-flyer";
import { findMunicipality } from "@/lib/tver/plan";
import { FlyerAdminPanel } from "@/components/tver-flyer/flyer-admin-panel";
import { FlyerCancelButton } from "@/components/tver-flyer/flyer-cancel-button";

interface Props { params: Promise<{ id: string }> }

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(d));
}

export default async function TverFlyerDetailPage({ params }: Props) {
  const { id } = await params;
  const { request, role } = await getTverFlyerById(id);
  const isAdmin = role === "ADMIN";
  const st = getFlyerStatusOption(request.status);
  const data = buildFlyerData(request);
  const names = request.municipalityCodes.map((c) => findMunicipality(c)?.name ?? c);

  const rows: [string, string][] = [
    ["商圏", `${request.prefName} ${names.join("・")}`],
    ["クライアント", request.clientName ?? "—"],
    ["業種", request.industry ?? "—"],
    ["CM秒数", `${request.adSeconds}秒`],
    ["予算指定", request.budget ? `¥${request.budget.toLocaleString("ja-JP")}（媒体費）` : "—（100万円での到達率を表示）"],
    ["依頼拠点", request.branch?.name ?? "—"],
  ];

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      <Link href="/dashboard/tver-flyer" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors mb-5">
        <ArrowLeft className="w-3.5 h-3.5" />一覧に戻る
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Tv2 className="text-blue-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{request.areaLabel}を、まるごと。</h2>
          <span className={`mt-1 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border ${st.className}`}>{st.label}</span>
        </div>
      </div>

      {/* 納品済み: ダウンロード */}
      {request.status === "DELIVERED" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-5">
          <p className="text-sm font-semibold text-emerald-800">チラシが納品されました（{fmtDate(request.deliveredAt)}）</p>
          {request.replyNote && <p className="text-xs text-emerald-700 mt-1 whitespace-pre-wrap">本部より: {request.replyNote}</p>}
          <p className="text-xs text-emerald-700 mt-3 mb-2">
            デザインは3種類あります。数値は同じなので、お好きなものをお使いください。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TVER_FLYER_TEMPLATES.map((t) => (
              <div key={t.key} className="bg-white border border-emerald-200 rounded-lg px-4 py-3">
                <p className="text-sm font-bold text-zinc-800">{t.label}</p>
                <p className="text-[11px] text-zinc-500 mb-2">{t.desc}</p>
                <div className="flex items-center gap-3">
                  <a href={`/api/tver-flyer/${request.id}/pdf?template=${t.key}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-emerald-700 hover:underline">画面で見る</a>
                  <a href={`/api/tver-flyer/${request.id}/pdf?template=${t.key}&dl=1`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                    <FileDown className="w-3.5 h-3.5" />ダウンロード
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 未納品（代表向け） */}
      {!isAdmin && (request.status === "PENDING" || request.status === "REVIEWING") && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-5 flex items-center gap-3">
          <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            {request.status === "PENDING" ? "本部が依頼を受け付けました。" : "本部が作成中です。"}
            通常1〜2営業日で納品します。納品されると通知が届きます。
          </p>
        </div>
      )}

      {/* 依頼内容 */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-50">
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap w-[140px] bg-zinc-50 align-top">{label}</th>
                <td className="px-5 py-3 text-sm text-zinc-800">{value}</td>
              </tr>
            ))}
            {request.note && (
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap bg-zinc-50 align-top">申し送り</th>
                <td className="px-5 py-3 text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">{request.note}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400 mb-6">
        依頼者: {request.createdBy?.name ?? "—"} ／ 依頼日: {fmtDate(request.createdAt)}
      </p>

      {/* 本部パネル */}
      {isAdmin && data && (
        <FlyerAdminPanel
          requestId={request.id}
          status={request.status}
          calc={{
            areaLabel: data.areaLabel,
            population: data.population,
            viewers: data.viewers,
            reach: data.reach,
            calcMonthly: data.calcMonthly,
            calcTotal: data.calcTotal,
            coveragePct: data.coverage.pct,
            coverageBudget: data.coverage.budget,
            coverageIsCustom: data.coverage.isCustom,
            neighbors: data.neighbors.map((n) => ({ areaLabel: n.areaLabel, monthly: n.monthly })),
          }}
          values={{
            monthlyOverride: request.monthlyOverride,
            totalOverride: request.totalOverride,
            catchCopy: request.catchCopy,
            issuerName: request.issuerName,
            issuerContact: request.issuerContact,
            replyNote: request.replyNote,
          }}
        />
      )}
      {isAdmin && !data && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">商圏データの計算に失敗しました（市区町村コードを確認してください）</div>
      )}

      {/* 取り下げ（代表・受付中のみ） */}
      {!isAdmin && request.status === "PENDING" && (
        <div className="mt-2"><FlyerCancelButton requestId={request.id} /></div>
      )}
    </div>
  );
}
