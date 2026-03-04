import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@/types/roles";
import { getGroupCompanyDetail } from "@/lib/actions/group-support";
import {
  STATUS_CONFIG,
  PHASE_OPTIONS,
} from "@/lib/constants/group-support";
import type { WeeklyStatus, ContactType } from "@/generated/prisma/client";
import { GroupCompanyEditForm } from "./edit-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  WEEKLY_SUBMISSION: "週次共有",
  FOLLOW_UP: "声かけ",
  CEO_COMMENT: "社長コメント",
  MANUAL_NOTE: "メモ",
};

const STATUS_LIGHT: Record<
  WeeklyStatus,
  { color: string; bgColor: string }
> = {
  GREEN: { color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
  YELLOW: { color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  RED: { color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  NONE: { color: "text-zinc-500", bgColor: "bg-zinc-50 border-zinc-200" },
};

export default async function GroupCompanyDetailPage({
  params,
}: PageProps) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const { company, weekId } = await getGroupCompanyDetail(id);
  if (!company) notFound();

  const currentSub = company.weeklySubmissions.find(
    (s) => s.weekId === weekId
  );
  const currentStatus: WeeklyStatus = currentSub?.status ?? "NONE";
  const sCfg = STATUS_CONFIG[currentStatus];
  const sLight = STATUS_LIGHT[currentStatus];
  const pOpt = PHASE_OPTIONS.find((p) => p.value === company.phase);

  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const fmtTime = (d: Date) =>
    new Date(d).toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Link
          href="/dashboard/group-support"
          className="hover:text-zinc-700 transition-colors"
        >
          グループサポート
        </Link>
        <span>/</span>
        <span className="text-zinc-700">{company.name}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">{company.name}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {company.ownerName} ・ {pOpt?.label ?? company.phase}
          </p>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${sLight.bgColor} ${sLight.color}`}
        >
          {sCfg.emoji} {sCfg.label}
        </span>
      </div>

      {/* 今週の回答 */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          今週の共有 ({weekId})
        </h2>
        {currentSub ? (
          <div className="space-y-2 text-xs">
            <Field label="調子" value={currentSub.q1} />
            <Field label="今週やったこと" value={currentSub.q2} />
            <Field label="来週やること" value={currentSub.q3} />
            <Field label="共有・相談" value={currentSub.q4} />
            <Field label="サポート" value={currentSub.q5} />
          </div>
        ) : (
          <p className="text-xs text-zinc-400">まだ共有されていません</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 左: 共有履歴（12週分） */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            共有履歴（直近12週）
          </h2>
          {company.weeklySubmissions.length === 0 ? (
            <p className="text-xs text-zinc-400">履歴なし</p>
          ) : (
            <div className="space-y-1.5">
              {company.weeklySubmissions.map((sub) => {
                const sl = STATUS_LIGHT[sub.status];
                const sc = STATUS_CONFIG[sub.status];
                return (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="text-zinc-400 w-16 flex-shrink-0">
                      {sub.weekId}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${sl.bgColor} ${sl.color}`}
                    >
                      {sc.emoji} {sc.label}
                    </span>
                    <span className="text-zinc-600 truncate">
                      {sub.q1}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右: メモ・フェーズ編集 */}
        <GroupCompanyEditForm
          id={company.id}
          currentMemo={company.memo ?? ""}
          currentPhase={company.phase}
        />
      </div>

      {/* コンタクトタイムライン */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          コンタクトタイムライン
        </h2>
        {company.contactHistories.length === 0 ? (
          <p className="text-xs text-zinc-400">履歴なし</p>
        ) : (
          <div className="space-y-2">
            {company.contactHistories.map((ch) => (
              <div
                key={ch.id}
                className="flex gap-3 text-xs border-l-2 border-zinc-200 pl-3 py-1"
              >
                <div className="flex-shrink-0 w-24 text-zinc-400">
                  {fmtTime(ch.createdAt)}
                </div>
                <div>
                  <span className="inline-block px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 text-[10px] mr-1.5">
                    {CONTACT_TYPE_LABEL[ch.type]}
                  </span>
                  {ch.actorName && (
                    <span className="text-zinc-400 mr-1.5">
                      {ch.actorName}:
                    </span>
                  )}
                  <span className="text-zinc-700">{ch.content}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 戻るリンク */}
      <Link
        href="/dashboard/group-support"
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
      >
        ← 一覧に戻る
      </Link>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-zinc-400">{label}:</span>{" "}
      <span className="text-zinc-700 whitespace-pre-wrap">{value}</span>
    </div>
  );
}
