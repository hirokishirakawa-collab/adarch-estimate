// TVer小口申込 — 本部の詳細（ADMINだけ）。状態を進める／お客様へ連絡／入金確認／請求書再発行
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { db } from "@/lib/db";
import { AD_SECONDS, orderNumberLabel, planByKey, quote } from "@/lib/tver-order/plans";
import { TVER_ORDER_STATUS_LABEL, appUrl } from "@/lib/tver-order/service";
import { InvoiceList, OrderAdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";
const fmt = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(d) : "—");
const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default async function AdminTverOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const o = await db.tverOrder.findUnique({ where: { id }, include: { invoices: { orderBy: { seq: "asc" } }, groupCompany: { select: { id: true, name: true, ownerName: true, prefecture: true, linkedUsers: { where: { isActive: true }, select: { email: true }, take: 1 } } } } });
  if (!o) notFound();
  const no = orderNumberLabel(o.number, o.createdAt);
  const plan = planByKey(o.planKey);
  const q = quote(o.mediaFeeExclTax, o.setupFeeExclTax > 0, o.months);
  const statusUrl = `${appUrl()}/order/tver/${o.token}`;

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <Link href="/dashboard/admin/tver-orders" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 mb-4"><ChevronLeft className="w-4 h-4" />一覧へ</Link>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">{no}　{o.advertiserName}</h1>
          <p className="text-sm text-zinc-500">{o.prefName} {o.areaLabel}・{plan?.name ?? o.planKey}（{AD_SECONDS}秒・{o.months}ヶ月・月払い）・月額 {yen(o.mediaFeeExclTax)}（税抜）・契約総額 {yen(o.totalInclTax)}（税込）・{o.paymentMethod === "BANK_TRANSFER" ? "銀行振込" : "カード"}</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-800 text-sm font-medium">{TVER_ORDER_STATUS_LABEL[o.status]}</span>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">商談中の代表（案内元）</h2>
            {o.groupCompany ? (
              <p className="text-sm text-zinc-800">{o.groupCompany.name}{o.groupCompany.prefecture ? `（${o.groupCompany.prefecture}）` : ""}　代表 {o.groupCompany.ownerName}　{o.groupCompany.linkedUsers[0]?.email ?? ""}</p>
            ) : (
              <p className="text-sm text-zinc-500">本部（?from= なしの申込）</p>
            )}
          </section>
          <section className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">広告主</h2>
            <Row k="会社名" v={o.advertiserName} />
            <Row k="ご担当" v={`${o.contactName}　${o.email}　${o.phone}`} />
            <Row k="法人番号" v={o.corporateNumber ?? <span className="text-orange-600">未記入（決済後にお客様が記入）</span>} />
            <Row k="本店所在地" v={o.address ? `${o.postalCode ? `〒${o.postalCode} ` : ""}${o.address}` : "未記入"} />
            <Row k="代表者" v={o.representativeName ?? "未記入"} />
            <Row k="業種 / LP" v={`${o.industry ?? "—"} / ${o.landingPageUrl ?? "—"}`} />
            <Row k="備考" v={o.notes ?? "—"} />
            <Row k="詳細記入" v={fmt(o.detailsCompletedAt)} />
          </section>
          <section className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">申込・契約・お支払い</h2>
            <Row k="申込日時" v={fmt(o.createdAt)} />
            <Row k="規約同意" v={`${o.signerName} が ${fmt(o.agreedAt)} に同意（${o.termsVersion}・IP ${o.agreedIp ?? "—"}）`} />
            <Row k="内訳（税抜）" v={`月額 ${yen(q.mediaFeeExclTax)} × ${o.months}ヶ月${q.setupFeeExclTax ? ` ＋ 初期登録費 ${yen(q.setupFeeExclTax)}（初月に請求）` : "（初期登録費なし）"}`} />
            <Row k="目安" v={`月 約${o.estImpressions.toLocaleString("ja-JP")}再生・約${o.estReach.toLocaleString("ja-JP")}人`} />
            <Row k="契約成立" v={o.paidAt ? `${fmt(o.paidAt)}　初月 ${yen(o.paidAmount ?? 0)}　${o.paymentNote ?? ""}` : <span className="text-orange-600">初月の入金 未確認</span>} />
            <Row k="動画" v={o.materialUrl ? <><a className="text-orange-600 underline" href={o.materialUrl} target="_blank" rel="noopener">{o.materialUrl}</a>{o.materialNote ? `　${o.materialNote}` : ""}</> : (o.hasVideo ? "未提出（お客様が用意）" : "なし＝制作は案内元が相談")} />
            <Row k="進捗ページ" v={<a className="text-orange-600 underline" href={statusUrl} target="_blank" rel="noopener">{statusUrl}</a>} />
          </section>
          <section className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-2">月ごとの請求（{o.invoices.filter((i) => i.status === "PAID").length}/{o.months} 入金済み）</h2>
            <InvoiceList
              orderId={o.id}
              canIssueNext={!!o.paidAt && o.invoices.length < o.months}
              invoices={o.invoices.map((i) => ({ id: i.id, seq: i.seq, amountInclTax: i.amountInclTax, includesSetupFee: i.includesSetupFee, method: i.method, status: i.status, dueDate: i.dueDate.toISOString(), paidAt: i.paidAt?.toISOString() ?? null, paymentNote: i.paymentNote, squareLinkUrl: i.squareLinkUrl, mfBillingNumber: i.mfBillingNumber, mfPdfUrl: i.mfPdfUrl }))}
            />
          </section>
        </div>
        <div className="lg:col-span-2">
          <OrderAdminPanel
            id={o.id}
            status={o.status}
            paid={!!o.paidAt}
            paymentMethod={o.paymentMethod}
            detailsDone={!!o.detailsCompletedAt}
            customerNote={o.customerNote ?? ""}
            adminNote={o.adminNote ?? ""}
            liveStartDate={o.liveStartDate?.toISOString().slice(0, 10) ?? ""}
            liveEndDate={o.liveEndDate?.toISOString().slice(0, 10) ?? ""}
            reportUrl={o.reportUrl ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-zinc-100 text-sm"><div className="w-36 shrink-0 text-zinc-500">{k}</div><div className="text-zinc-900 break-all">{v}</div></div>
  );
}
