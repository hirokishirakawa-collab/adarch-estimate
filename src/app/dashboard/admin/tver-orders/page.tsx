// ==============================================================
// TVer小口申込 — 本部の一覧（ADMINだけ。ページとアクションで二重に判定）
//   お客様が /order/tver から申し込んだものが並ぶ。状態・拠点・期間で絞り、列で並べ替え
// ==============================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { db } from "@/lib/db";
import type { TverOrderStatus } from "@/generated/prisma/client";
import { orderNumberLabel, planByKey } from "@/lib/tver-order/plans";
import { TVER_ORDER_STATUS_LABEL } from "@/lib/tver-order/service";
import { OrdersTable, type OrderRow } from "./orders-table";

export const dynamic = "force-dynamic";

type SP = { status?: string; company?: string; from?: string; to?: string };

export default async function AdminTverOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const statuses = Object.keys(TVER_ORDER_STATUS_LABEL) as TverOrderStatus[];
  const status = statuses.includes(sp.status as TverOrderStatus) ? (sp.status as TverOrderStatus) : null;
  const fromD = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? new Date(sp.from) : null;
  const toD = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? new Date(new Date(sp.to).getTime() + 86_400_000) : null;

  const [orders, companies] = await Promise.all([
    db.tverOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(sp.company ? { groupCompanyId: sp.company } : {}),
        ...(fromD || toD ? { createdAt: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lt: toD } : {}) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { groupCompany: { select: { id: true, name: true, ownerName: true, prefecture: true } } },
    }),
    db.groupCompany.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    no: orderNumberLabel(o.number, o.createdAt),
    token: o.token,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    status: o.status,
    statusLabel: TVER_ORDER_STATUS_LABEL[o.status],
    advertiser: o.advertiserName,
    contact: o.contactName,
    email: o.email,
    area: `${o.prefName} ${o.areaLabel}`,
    plan: planByKey(o.planKey)?.name ?? o.planKey,
    total: o.totalInclTax,
    payment: o.paymentMethod === "BANK_TRANSFER" ? "振込" : "カード",
    company: o.groupCompany ? `${o.groupCompany.name}${o.groupCompany.ownerName ? `（${o.groupCompany.ownerName}）` : ""}` : "本部",
    detailsDone: !!o.detailsCompletedAt,
    hasMaterial: !!o.materialUrl,
  }));

  const counts = statuses.map((s) => ({ s, n: orders.filter((o) => o.status === s).length }));
  const paidTotal = orders.filter((o) => o.paidAt).reduce((a, o) => a + o.totalInclTax, 0);
  const todo = orders.filter((o) => (o.status === "PAID" && o.detailsCompletedAt) || o.status === "MATERIAL_RECEIVED").length;

  return (
    <div className="px-6 py-6 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <MonitorPlay className="text-orange-500" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">TVer小口申込</h1>
            <p className="text-xs text-zinc-500">お客様が /order/tver でWeb完結した申込。案内元の拠点（商談中の代表）ごとに見えます</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700">表示 {orders.length}件</span>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">入金済 合計 ¥{paidTotal.toLocaleString("ja-JP")}</span>
          {todo > 0 && <span className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 font-medium">本部の手番 {todo}件</span>}
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 mb-4 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">状態</span>
          <select name="status" defaultValue={status ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">すべて</option>
            {counts.map(({ s, n }) => (
              <option key={s} value={s}>{TVER_ORDER_STATUS_LABEL[s]}{n ? `（${n}）` : ""}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">案内元の拠点</span>
          <select name="company" defaultValue={sp.company ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">すべて</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">申込日 から</span>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">まで</span>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="border border-zinc-200 rounded-lg px-2 py-1.5 bg-white" />
        </label>
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white">絞り込む</button>
        <Link href="/dashboard/admin/tver-orders" className="px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-800">解除</Link>
        <span className="ml-auto text-xs text-zinc-400">申込URL: <code className="bg-zinc-100 px-1.5 py-0.5 rounded">/order/tver?from=&lt;拠点ID&gt;</code>（各拠点のパッケージ詳細に「URLをコピー」あり）</span>
      </form>

      <OrdersTable rows={rows} />
    </div>
  );
}
