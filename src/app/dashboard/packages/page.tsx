import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { FavoriteButton } from "@/components/layout/favorite-button";
import { listPackages, getPackageStats } from "@/lib/packages/query";
import { formatPackagePrice, parseDeliverables, STATUS_LABEL } from "@/lib/packages/types";
import type { SalesPackageStatus } from "@/generated/prisma/client";

export const metadata = { title: "パッケージ | Ad-Arch" };

const STATUS_CHIP: Record<SalesPackageStatus, string> = {
  PROPOSED: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  RETIRED: "bg-zinc-200 text-zinc-600",
};

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { role: true } });
  const isAdmin = me?.role === "ADMIN";

  const sp = await searchParams;
  const filter = sp.status === "PROPOSED" || sp.status === "ACTIVE" || sp.status === "RETIRED" ? sp.status : null;

  const all = await listPackages();
  const stats = await getPackageStats(all.map((p) => p.id));
  const counts = { PROPOSED: 0, ACTIVE: 0, RETIRED: 0 } as Record<SalesPackageStatus, number>;
  for (const p of all) counts[p.status]++;
  const rows = filter ? all.filter((p) => p.status === filter) : all.filter((p) => p.status !== "RETIRED");

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
            <Package className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-zinc-900">パッケージ</h2>
              <FavoriteButton path="/dashboard/packages" label="パッケージ" />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              グループで統一して売る商品。稼働中のものは営業フォーム・見積・チャットにそのまま並びます。新しい売り物のアイデアは「起案する」から。
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/packages/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#1F3A5F] rounded-lg hover:bg-[#16304f]"
        >
          <Plus className="w-4 h-4" />
          {isAdmin ? "パッケージを作る" : "パッケージを起案する"}
        </Link>
      </div>

      {/* 状態タブ */}
      <div className="flex items-center gap-1.5 text-xs">
        {[
          { key: null, label: "稼働中＋提案中", n: counts.ACTIVE + counts.PROPOSED },
          { key: "ACTIVE", label: "稼働中", n: counts.ACTIVE },
          { key: "PROPOSED", label: "提案中", n: counts.PROPOSED },
          { key: "RETIRED", label: "終了", n: counts.RETIRED },
        ].map((t) => {
          const active = filter === t.key;
          return (
            <Link
              key={t.label}
              href={t.key ? `/dashboard/packages?status=${t.key}` : "/dashboard/packages"}
              className={`px-3 py-1.5 rounded-full border ${active ? "bg-zinc-800 text-white border-zinc-800" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}
            >
              {t.label} <span className="opacity-70">{t.n}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-10 text-center text-sm text-zinc-500">
          まだパッケージがありません。「起案する」から最初の1本を出してください。
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p) => {
            const s = stats[p.id];
            const items = parseDeliverables(p.deliverables);
            return (
              <Link
                key={p.id}
                href={`/dashboard/packages/${p.slug}`}
                className={`group bg-white rounded-xl border overflow-hidden flex flex-col hover:shadow-md transition-shadow ${p.status === "ACTIVE" ? "border-orange-200" : "border-zinc-200"}`}
              >
                <div className="aspect-[3/2] bg-zinc-100 overflow-hidden">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-400">画像なし</div>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-orange-600">{p.category}</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 group-hover:text-[#1F3A5F]">{p.name}</h3>
                  {p.tagline && <p className="text-xs text-zinc-500 mt-0.5">{p.tagline}</p>}
                </div>
                <p className="text-lg font-extrabold text-zinc-900 tabular-nums">{formatPackagePrice(p)}</p>
                {items.length > 0 && (
                  <p className="text-[11px] text-zinc-500 line-clamp-2">{items.map((d) => `${d.name}×${d.qty}${d.unit}`).join("・")}</p>
                )}
                <div className="mt-auto pt-2 border-t border-zinc-100 flex items-center gap-3 text-[11px] text-zinc-500">
                  <span>送付 <b className="text-zinc-800">{s?.sent ?? 0}</b></span>
                  <span>返信 <b className="text-zinc-800">{s?.replied ?? 0}</b></span>
                  <span>受注 <b className="text-emerald-700">{s?.won ?? 0}</b></span>
                  {p.status === "PROPOSED" && p.proposedBy && (
                    <span className="ml-auto truncate">起案: {p.proposedBy.groupCompany?.name ?? p.proposedBy.name ?? "—"}</span>
                  )}
                </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
