import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tv2, ExternalLink } from "lucide-react";
import { getTverCampaignById } from "@/lib/actions/tver-campaign";
import {
  getCampaignStatusOption,
  getBudgetTypeLabel,
  getCompanionMobileLabel,
  getCompanionPcLabel,
  getFreqCapUnitLabel,
} from "@/lib/constants/tver-campaign";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(d));
}

function fmtBudget(v: unknown): string {
  const n = Number(v);
  return isNaN(n) ? "—" : `¥${n.toLocaleString("ja-JP")}`;
}

export default async function TverCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getTverCampaignById(id).catch(() => null);
  if (!result) notFound();
  const { campaign } = result;

  const status = getCampaignStatusOption(campaign.status);

  const freqCapText =
    campaign.freqCapUnit && campaign.freqCapCount
      ? `${getFreqCapUnitLabel(campaign.freqCapUnit)}に ${campaign.freqCapCount}回`
      : "設定なし";

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク */}
      <Link
        href="/dashboard/tver-campaign"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                   transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />TVer配信申請一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Tv2 className="text-blue-700" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{campaign.campaignName}</h2>
          <span className={`mt-1 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold
                             rounded-full border ${status.className}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* 申請内容テーブル */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden mb-5">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-50">
            {/* 広告主 */}
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                             whitespace-nowrap w-[160px] bg-zinc-50 align-top">
                広告主
              </th>
              <td className="px-5 py-3 text-sm text-zinc-800 font-semibold">
                {campaign.advertiser?.name ?? "—"}
              </td>
            </tr>

            {[
              ["キャンペーン名", campaign.campaignName],
              ["広告予算（税抜）", fmtBudget(campaign.budget)],
              ["配信期間", `${fmtDate(campaign.startDate)} 〜 ${fmtDate(campaign.endDate)}`],
              ["予算タイプ", getBudgetTypeLabel(campaign.budgetType)],
              ["フリークエンシーキャップ", freqCapText],
              ["コンパニオン AD（モバイル）", getCompanionMobileLabel(campaign.companionMobile)],
              ["コンパニオン AD（PC）", getCompanionPcLabel(campaign.companionPc)],
              ["登録拠点", campaign.branch?.name ?? "—"],
            ].map(([label, value]) => (
              <tr key={label as string}>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap bg-zinc-50 align-top">
                  {label}
                </th>
                <td className="px-5 py-3 text-sm text-zinc-800">{value}</td>
              </tr>
            ))}

            {/* LP URL */}
            {campaign.landingPageUrl && (
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                               whitespace-nowrap bg-zinc-50 align-top">
                  リンク先 LP URL
                </th>
                <td className="px-5 py-3">
                  <a
                    href={campaign.landingPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    {campaign.landingPageUrl}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 広告主ページリンク */}
      {campaign.advertiser && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 mb-5
                        flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-semibold">広告主 業態考査</span>
          <Link
            href={`/dashboard/tver-review/${campaign.advertiser.id}`}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            考査ページを開く
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* 管理者コメント */}
      {campaign.reviewNote && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-4 mb-5">
          <p className="text-xs font-semibold text-zinc-500 mb-2">管理者コメント</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
            {campaign.reviewNote}
          </p>
        </div>
      )}

      {/* メタ情報 */}
      <p className="text-xs text-zinc-400">
        申請者: {campaign.createdBy?.name ?? "—"} ／
        申請日: {fmtDate(campaign.createdAt)}
      </p>
    </div>
  );
}
