// ==============================================================
// Ad Arch Studio — 本部の一覧（ADMINだけ。ページとアクションで二重に判定）
//   公開MCP（/api/mcp/public）から来た発注・ご依頼の全件。期限切れは赤。担当の付け替え・迷惑・削除（確定前だけ）
//   下段: 県の担当表（1県1社・2社の県は順番）／公開MCPに出すもの（サービス・自社の資料・Wiki記事）
// ==============================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { db } from "@/lib/db";
import type { StudioInquiryStatus } from "@/generated/prisma/client";
import { STUDIO_KIND_LABEL, STUDIO_STATUS_LABEL, inquiryNumberLabel, isOverdue } from "@/lib/studio/labels";
import { InquiriesTable, type InquiryRow } from "@/components/studio/inquiries-table";
import { StudioSettings } from "./studio-settings";

export const dynamic = "force-dynamic";

type SP = { status?: string; assignee?: string; from?: string; to?: string };
const HQ_TITLE = /ADMIN向け|ADMIN専用|本部のみ/i;

export default async function AdminStudioInquiriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const statuses = Object.keys(STUDIO_STATUS_LABEL) as StudioInquiryStatus[];
  const status = statuses.includes(sp.status as StudioInquiryStatus) ? (sp.status as StudioInquiryStatus) : null;
  const fromD = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? new Date(`${sp.from}T00:00:00+09:00`) : null;
  const toD = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? new Date(new Date(`${sp.to}T00:00:00+09:00`).getTime() + 86_400_000) : null;

  const [inquiries, assignments, companies, packages, knowledge, wikis, published] = await Promise.all([
    db.studioInquiry.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(sp.assignee === "hq" ? { assignedBranchId: null } : sp.assignee === "branch" ? { assignedBranchId: { not: null } } : {}),
        ...(fromD || toD ? { createdAt: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lt: toD } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.studioPrefectureAssignment.findMany({ orderBy: [{ prefecture: "asc" }, { createdAt: "asc" }] }),
    db.groupCompany.findMany({ where: { isActive: true }, select: { id: true, name: true, prefecture: true }, orderBy: { name: "asc" } }),
    db.salesPackage.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, category: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.knowledgeSource.findMany({ where: { origin: "OWN", hqOnly: false, status: "READY" }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.wikiArticle.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 300 }),
    db.studioPublishedItem.findMany({ select: { type: true, refId: true } }),
  ]);

  const gcName = new Map(companies.map((c) => [c.id, c.name]));
  const assignmentByKey = new Map(assignments.map((a) => [`${a.groupCompanyId}|${a.branchId}`, a]));
  const rows: InquiryRow[] = inquiries.map((q) => {
    const a = q.assignedGroupCompanyId ? assignmentByKey.get(`${q.assignedGroupCompanyId}|${q.assignedBranchId}`) : undefined;
    return {
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
      assignee: q.assignedGroupCompanyId ? gcName.get(q.assignedGroupCompanyId) ?? "（県本部）" : "本部",
      assignmentId: a?.id ?? null,
      routeReason: q.routeReason,
      overdue: isOverdue(q),
      suspectedSpam: q.suspectedSpam,
    };
  });

  const overdue = rows.filter((r) => r.overdue).length;
  const unassigned = inquiries.filter((q) => !q.assignedBranchId && q.status === "RECEIVED").length;
  const pub = (t: string) => published.filter((p) => p.type === t).map((p) => p.refId);

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <Inbox className="text-orange-500" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Ad Arch Studio の発注・ご依頼</h1>
            <p className="text-xs text-zinc-500">公開のAI窓口（/api/mcp/public）から来たもの。相手には「アドアーチ」としか見えず、担当の県本部名は伝わりません</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700">表示 {rows.length}件</span>
          {unassigned > 0 && <span className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700">本部で振り分け {unassigned}件</span>}
          {overdue > 0 && <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-medium">期限切れ {overdue}件</span>}
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 mb-4 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">状態</span>
          <select name="status" defaultValue={status ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">すべて</option>
            {statuses.map((s) => <option key={s} value={s}>{STUDIO_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">担当</span>
          <select name="assignee" defaultValue={sp.assignee ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">すべて</option>
            <option value="hq">本部（未割当）</option>
            <option value="branch">県本部</option>
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
        <Link href="/dashboard/admin/studio-inquiries" className="px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-800">解除</Link>
      </form>

      <InquiriesTable
        rows={rows}
        mode="admin"
        assignments={assignments.filter((a) => a.active).map((a) => ({ id: a.id, label: `${a.prefecture} ${gcName.get(a.groupCompanyId) ?? ""}` }))}
      />

      <StudioSettings
        assignments={assignments.map((a) => ({ id: a.id, prefecture: a.prefecture, company: gcName.get(a.groupCompanyId) ?? "（停止中の社）", active: a.active, lastAssignedAt: a.lastAssignedAt?.toISOString() ?? null }))}
        companies={companies.map((c) => ({ id: c.id, label: `${c.name}${c.prefecture ? `（${c.prefecture}）` : ""}` }))}
        packages={packages.map((p) => ({ id: p.id, label: `${p.name}（${p.category}）` }))}
        knowledge={knowledge.map((k) => ({ id: k.id, label: k.title }))}
        wikis={wikis.filter((w) => !HQ_TITLE.test(w.title)).map((w) => ({ id: w.id, label: w.title }))}
        published={{ PACKAGE: pub("PACKAGE"), KNOWLEDGE: pub("KNOWLEDGE"), WIKI: pub("WIKI") }}
      />
    </div>
  );
}
