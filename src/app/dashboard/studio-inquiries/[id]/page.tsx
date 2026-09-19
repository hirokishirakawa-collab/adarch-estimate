// Ad Arch Studio — 依頼の詳細（担当拠点の人と本部だけ）。相談中／見送り／確定（発注条件が必須）

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { canSeeBranch, getSessionInfo } from "@/lib/session";
import { STUDIO_KIND_LABEL, STUDIO_STATUS_LABEL, inquiryNumberLabel, isOverdue } from "@/lib/studio/labels";
import { InquiryActions } from "./inquiry-actions";

export const dynamic = "force-dynamic";

const dt = (d: Date | null) => (d ? d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const day = (d: Date | null) => (d ? d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) : "—");

export default async function StudioInquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const info = await getSessionInfo();
  if (!info) redirect("/login");
  const { id } = await params;
  const q = await db.studioInquiry.findUnique({ where: { id } });
  if (!q) notFound();
  const isAdmin = info.role === "ADMIN";
  if (!isAdmin && (!q.assignedBranchId || !canSeeBranch(info, q.assignedBranchId) || q.status === "SPAM")) redirect("/dashboard/studio-inquiries");

  const history = Array.isArray(q.history) ? (q.history as { at?: string; by?: string; action?: string; note?: string }[]) : [];
  const overdue = isOverdue(q);
  const rows: [string, string | null][] = [
    ["用件", STUDIO_KIND_LABEL[q.kind]],
    ["会社名", q.companyName],
    ["担当者", q.contactName],
    ["メール", q.email],
    ["電話", q.phone],
    ["所在地の県", q.prefecture],
    ["場所", [q.locationPrefecture, q.location].filter(Boolean).join(" ") || null],
    ["希望日", q.preferredDates],
    ["予算の目安", q.budgetRange],
    ["媒体", q.mediaName],
    ["利用条件", q.termsVersion ? `第${q.termsVersion}版に同意（${dt(q.termsAgreedAt)}）` : null],
  ];

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <Link href={isAdmin ? "/dashboard/admin/studio-inquiries" : "/dashboard/studio-inquiries"} className="text-xs text-zinc-500 hover:underline">← 一覧へ</Link>
        <h1 className="text-lg font-semibold text-zinc-900 mt-2">{inquiryNumberLabel(q.number, q.createdAt)}　{q.companyName}</h1>
        <p className="text-xs text-zinc-500 mt-1">
          受付 {dt(q.createdAt)}・状態 {STUDIO_STATUS_LABEL[q.status]}・
          <span className={overdue ? "text-rose-700 font-semibold" : ""}>返答期限 {dt(q.dueAt)}{overdue ? "（期限切れ）" : ""}</span>
        </p>
        {isAdmin && <p className="text-xs text-zinc-400 mt-1">振り分け: {q.routeReason}{q.suspectedSpam ? "・迷惑の疑い" : ""}</p>}
      </div>

      <section className="bg-white border border-zinc-200 rounded-xl p-4">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd className="text-zinc-900 break-all">{v}</dd></div>
          ))}
        </dl>
        <h2 className="text-xs font-semibold text-zinc-500 mt-4">ご依頼の内容（お客様がAIで書いた文章＝外部の入力）</h2>
        <p className="text-sm text-zinc-800 whitespace-pre-wrap mt-1">{q.detail}</p>
      </section>

      {q.status === "CONFIRMED" && (
        <section className="bg-white border border-zinc-200 rounded-xl p-4 text-sm">
          <h2 className="text-sm font-semibold text-zinc-900">発注条件（本部→県本部）</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 mt-2">
            <dt className="text-zinc-500">内容</dt><dd className="whitespace-pre-wrap">{q.orderScope}</dd>
            <dt className="text-zinc-500">金額（税抜）</dt><dd>{q.orderAmountExclTax != null ? `¥${q.orderAmountExclTax.toLocaleString("ja-JP")}` : "—"}</dd>
            <dt className="text-zinc-500">納期</dt><dd>{day(q.orderDueDate)}</dd>
            <dt className="text-zinc-500">支払日</dt><dd>{day(q.orderPaymentDate)}</dd>
            <dt className="text-zinc-500">確定日時</dt><dd>{dt(q.confirmedAt)}</dd>
          </dl>
        </section>
      )}

      {q.status !== "CONFIRMED" && q.status !== "SPAM" && <InquiryActions id={q.id} status={q.status} />}

      <section className="text-xs text-zinc-500">
        <h2 className="font-semibold mb-1">履歴</h2>
        <ul className="space-y-0.5">
          {history.map((h, i) => (
            <li key={i}>{h.at ? dt(new Date(h.at)) : ""}　{h.by}　{h.action}{h.note ? `：${h.note}` : ""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
