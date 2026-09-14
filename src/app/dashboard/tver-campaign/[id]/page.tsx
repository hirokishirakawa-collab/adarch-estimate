import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tv2, ExternalLink } from "lucide-react";
import { getTverCampaignById } from "@/lib/actions/tver-campaign";
import { DeleteButton } from "./DeleteButton";
import { StatusUpdateForm } from "./StatusUpdateForm";
import {
  getCampaignStatusOption,
  getBudgetTypeLabel,
  getCompanionMobileLabel,
  getCompanionPcLabel,
  getFreqCapUnitLabel,
  getGenderTargetLabel,
  AD_DURATION_OPTIONS,
  DEVICE_OPTIONS,
  AGE_GROUP_OPTIONS,
  INTEREST_OPTIONS,
  INCOME_OPTIONS,
  TV_VIEWING_OPTIONS,
  DEMOGRAPHIC_OPTIONS,
  GENRE_OPTIONS,
  GENRE_EXCLUDE_OPTIONS,
  SUB_GENRE_EXCLUDE_OPTIONS,
} from "@/lib/constants/tver-campaign";
import { areaPopulation, describeAreas } from "@/lib/tver-campaign/submit";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date(d));
}

function fmtBudget(v: unknown): string {
  const n = Number(v);
  return isNaN(n) ? "—" : `¥${n.toLocaleString("ja-JP")}`;
}

type Opt = readonly { value: string; label: string }[];
const labels = (opts: Opt, v: unknown) =>
  Array.isArray(v) && v.length > 0 ? v.map((x) => opts.find((o) => o.value === x)?.label ?? String(x)).join("、") : null;

/** settings(JSON) → 表示行。指定のない項目は出さない */
function settingRows(settings: unknown): [string, string][] {
  if (!settings || typeof settings !== "object") return [];
  const s = settings as Record<string, unknown>;
  const f = (s.frequency ?? {}) as Record<string, number | null>;
  const freq = [
    f.period && `期間 ${f.period}回`, f.weekly && `1週間 ${f.weekly}回`, f.daily && `1日 ${f.daily}回`, f.hourly && `1時間 ${f.hourly}回`,
  ].filter(Boolean).join(" / ");
  const hourly = s.hourlyRatios && typeof s.hourlyRatios === "object"
    ? Object.entries(s.hourlyRatios as Record<string, number>).map(([h, r]) => `${h.padStart(2, "0")}時 ${r}%`).join("、")
    : null;
  const rows: [string, string | null][] = [
    ["広告再生時間", labels(AD_DURATION_OPTIONS, s.adDurations)],
    ["デバイス", labels(DEVICE_OPTIONS, s.devices)],
    ["年齢", labels(AGE_GROUP_OPTIONS, s.ageGroups)],
    ["デモグラフィック", labels(DEMOGRAPHIC_OPTIONS, s.demographics)],
    ["興味関心", labels(INTEREST_OPTIONS, s.interests)],
    ["世帯年収", labels(INCOME_OPTIONS, s.incomes)],
    ["テレビ視聴傾向", labels(TV_VIEWING_OPTIONS, s.tvViewings)],
    ["ジャンル", labels(GENRE_OPTIONS, s.genres)],
    ["除外ジャンル", labels(GENRE_EXCLUDE_OPTIONS, s.genreExcludes)],
    ["除外サブジャンル", labels(SUB_GENRE_EXCLUDE_OPTIONS, s.subGenreExcludes)],
    ["フリークエンシー（詳細）", freq || null],
    ["時間毎予算割合", hourly],
    ["日予算の設定", s.dailyBudget ? "あり" : null],
    ["配信最終日の日予算", s.lastDayBudget ? "あり" : null],
    ["申請経路", s.via === "AI" ? "AI連携" : null],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

export default async function TverCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getTverCampaignById(id).catch(() => null);
  if (!result) notFound();
  const { campaign, role } = result;
  const isAdmin = role === "ADMIN";

  const status = getCampaignStatusOption(campaign.status);

  const freqCapText =
    campaign.freqCapUnit && campaign.freqCapCount
      ? `${getFreqCapUnitLabel(campaign.freqCapUnit)}に ${campaign.freqCapCount}回`
      : "設定なし";

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto w-full">
      {/* 戻るリンク＋削除ボタン */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/dashboard/tver-campaign"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800
                     transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />TVer配信申請一覧に戻る
        </Link>
        {isAdmin && <DeleteButton campaignId={campaign.id} />}
      </div>

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
              ["性別ターゲティング", getGenderTargetLabel(campaign.genderTarget)],
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

            {/* 配信エリア */}
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500
                             whitespace-nowrap bg-zinc-50 align-top">
                配信エリア
              </th>
              <td className="px-5 py-3">
                {campaign.areas.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {describeAreas(campaign.areas).map((a) => (
                      <span
                        key={a.label}
                        className="inline-flex items-center px-2 py-0.5 text-[11px]
                                   font-medium rounded-full bg-blue-50 text-blue-700
                                   border border-blue-200"
                      >
                        {a.label}
                      </span>
                    ))}
                    <span className="w-full text-[11px] text-zinc-400">
                      人口 計{areaPopulation(campaign.areas).toLocaleString("ja-JP")}人（住民基本台帳 2025年1月1日）
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-400">未設定</span>
                )}
              </td>
            </tr>

            {/* ターゲティング・配信設定（申請フォーム／AI連携の settings） */}
            {settingRows(campaign.settings).map(([label, value]) => (
              <tr key={label}>
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

      {/* 管理者用：ステータス更新 */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-5">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">ステータス管理（管理者）</h3>
          <StatusUpdateForm
            campaignId={campaign.id}
            currentStatus={campaign.status}
            currentReviewNote={campaign.reviewNote}
          />
        </div>
      )}

      {/* 管理者コメント（非Admin向け表示） */}
      {!isAdmin && campaign.reviewNote && (
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
