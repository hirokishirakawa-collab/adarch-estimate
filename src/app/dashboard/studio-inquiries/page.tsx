// ==============================================================
// Ad Arch Studio — 拠点の依頼一覧（自拠点に振られたものだけ。本部は全件）
//   相手には「アドアーチ」として連絡する。営業時間で2時間以内が約束（期限切れは赤）
// ==============================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionInfo, ownBranchIds } from "@/lib/session";
import type { StudioInquiryStatus } from "@/generated/prisma/client";
import { STUDIO_KIND_LABEL, STUDIO_STATUS_LABEL, inquiryNumberLabel, isOverdue } from "@/lib/studio/labels";
import { InquiriesTable, type InquiryRow } from "@/components/studio/inquiries-table";

export const dynamic = "force-dynamic";

type SP = { status?: string; from?: string; to?: string };

export default async function StudioInquiriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const sp = await searchParams;
  const statuses = Object.keys(STUDIO_STATUS_LABEL) as StudioInquiryStatus[];
  const status = statuses.includes(sp.status as StudioInquiryStatus) ? (sp.status as StudioInquiryStatus) : null;
  const fromD = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? new Date(`${sp.from}T00:00:00+09:00`) : null;
  const toD = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? new Date(new Date(`${sp.to}T00:00:00+09:00`).getTime() + 86_400_000) : null;

  // 本部は全件。拠点は自拠点に振られたものだけ（所属が無ければ何も見えない）。迷惑は拠点に出さない
  const ids = ownBranchIds(info);
  const scope = info.role === "ADMIN" ? {} : { assignedBranchId: { in: ids.length ? ids : ["__none__"] }, status: { not: "SPAM" as const } };

  const inquiries = await db.studioInquiry.findMany({
    where: {
      ...scope,
      ...(status ? { status } : {}),
      ...(fromD || toD ? { createdAt: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lt: toD } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const rows: InquiryRow[] = inquiries.map((q) => ({
    id: q.id,
    no: inquiryNumberLabel(q.number, q.createdAt),
    createdAt: q.createdAt.toISOString(),
    dueAt: q.dueAt.toISOString(),
    status: q.status,
    statusLabel: STUDIO_STATUS_LABEL[q.status],
    kindLabel: STUDIO_KIND_LABEL[q.kind],
    company: q.companyName,
    contact: q.contactName,
    email: q.email,
    phone: q.phone,
    area: [q.locationPrefecture ?? q.prefecture, q.location].filter(Boolean).join(" "),
    assignee: "",
    assignmentId: null,
    routeReason: q.routeReason,
    overdue: isOverdue(q),
    suspectedSpam: q.suspectedSpam,
  }));
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <Inbox className="text-orange-500" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">AI窓口からの依頼</h1>
            <p className="text-xs text-zinc-500">Ad Arch Studio（公開のAI窓口）から貴社の県に届いた依頼です。お客様には「アドアーチ」として、営業時間で2時間以内にご連絡ください</p>
          </div>
        </div>
        {overdue > 0 && <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">期限切れ {overdue}件</span>}
      </div>

      <form className="flex flex-wrap items-end gap-3 mb-4 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">状態</span>
          <select name="status" defaultValue={status ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">すべて</option>
            {statuses.filter((s) => s !== "SPAM").map((s) => <option key={s} value={s}>{STUDIO_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">受付日 から</span>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">まで</span>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white" />
        </label>
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white">絞り込む</button>
        <Link href="/dashboard/studio-inquiries" className="px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-800">解除</Link>
      </form>

      <InquiriesTable rows={rows} mode="branch" />
    </div>
  );
}
