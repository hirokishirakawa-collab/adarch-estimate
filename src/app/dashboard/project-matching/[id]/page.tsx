import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar, Building2, Trophy } from "lucide-react";
import {
  getProjectRequestDetail,
  getMyEligibility,
} from "@/lib/actions/project-matching";
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  STATUS_CONFIG,
  formatBudget,
} from "@/lib/constants/project-matching";
import { ApplicationForm } from "./application-form";
import { MatchButton } from "./match-button";
import { EligibilityCard } from "./contribution-score-card";

export default async function ProjectRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { request, currentCompanyId } = await getProjectRequestDetail(id);
  if (!request) notFound();

  const catLabel =
    CATEGORY_OPTIONS.find((c) => c.value === request.category)?.label ??
    request.category;
  const freqLabel =
    FREQUENCY_OPTIONS.find((f) => f.value === request.frequency)?.label ??
    request.frequency;
  const statusCfg = STATUS_CONFIG[request.status];
  const isOwner = request.postedByCompanyId === currentCompanyId;
  const hasApplied = request.applications.some(
    (a) => a.applicantCompany.id === currentCompanyId
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <Link
        href="/dashboard/project-matching"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        案件一覧に戻る
      </Link>

      {/* ヘッダー */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}
          >
            {statusCfg.label}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-50 border border-violet-200 text-violet-700">
            {catLabel}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600">
            {freqLabel}
          </span>
        </div>
        <h1 className="text-lg font-bold text-zinc-900">{request.title}</h1>
        <p className="text-sm text-zinc-600 mt-2 whitespace-pre-wrap">
          {request.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            {request.postedByCompany.name}（{request.postedByCompany.ownerName}）
          </span>
          {request.prefecture && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {request.prefecture}
            </span>
          )}
          <span>予算: {formatBudget(request.budget)}</span>
          {request.deadline && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              納期:{" "}
              {new Date(request.deadline).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          <span className="text-zinc-400">
            投稿:{" "}
            {new Date(request.createdAt).toLocaleDateString("ja-JP", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {/* マッチ済みの場合 */}
        {request.matchedCompany && (
          <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
            <Trophy className="w-3.5 h-3.5 inline mr-1" />
            マッチ先: {request.matchedCompany.name}（{request.matchedCompany.ownerName}）
          </div>
        )}
      </div>

      {/* 応募エリア（他社の案件 & OPEN の場合） */}
      {!isOwner && request.status === "OPEN" && !hasApplied && (
        await (async () => {
          const eligibility = await getMyEligibility();
          return (
            <>
              <EligibilityCard {...eligibility} />
              {eligibility.canApply ? (
                <div className="rounded-lg border border-zinc-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-zinc-900 mb-3">
                    この案件に応募する
                  </h2>
                  <ApplicationForm projectRequestId={request.id} />
                </div>
              ) : null}
            </>
          );
        })()
      )}

      {!isOwner && hasApplied && request.status === "OPEN" && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
          この案件に応募済みです
        </div>
      )}

      {/* 応募一覧（投稿者のみ表示） */}
      {isOwner && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">
            応募一覧（{request.applications.length}件）
          </h2>
          {request.applications.length === 0 ? (
            <p className="text-xs text-zinc-400">まだ応募がありません</p>
          ) : (
            <div className="space-y-3">
              {request.applications.map((app) => (
                <div
                  key={app.id}
                  className="rounded-md border border-zinc-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">
                          {app.applicantCompany.name}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {app.applicantCompany.ownerName}
                        </span>
                        {app.applicantCompany.prefecture && (
                          <span className="text-[11px] text-zinc-400">
                            {app.applicantCompany.prefecture}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-zinc-400">
                          {new Date(app.createdAt).toLocaleDateString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {app.applicantCompany.specialty && (
                        <p className="text-[11px] text-zinc-400 mt-1">
                          得意: {app.applicantCompany.specialty}
                        </p>
                      )}
                      <p className="text-xs text-zinc-600 mt-1.5 whitespace-pre-wrap">
                        {app.message}
                      </p>
                    </div>
                    {request.status === "OPEN" && (
                      <MatchButton
                        projectRequestId={request.id}
                        applicantCompanyId={app.applicantCompany.id}
                        applicantName={app.applicantCompany.name}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
