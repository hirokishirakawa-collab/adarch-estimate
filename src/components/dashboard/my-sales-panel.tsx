import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ArrowRight } from "lucide-react";
import type { LeadStatus } from "@/generated/prisma/client";

// 「あなたの営業」数値パネル（本人のみの集計）。
// 営業フロー画面とメインダッシュボードの両方で使う共有コンポーネント。
// 数値の公開範囲は「本人のみ＋本部は全員分」。本パネルは常に本人の数字。

const APPROACHED: LeadStatus[] = ["CALLED", "APPOINTMENT", "DEAL_CONVERTED"];

export async function MySalesPanel({ showLink = false }: { showLink?: boolean }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const me = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!me) return null;

  // 担当しているリードのエリア（重複なし）＝「担当エリア」とみなす
  const myAreaRows = await db.lead.findMany({
    where: { assigneeId: me.id, area: { not: null } },
    select: { area: true },
    distinct: ["area"],
  });
  const myAreas = myAreaRows.map((r) => r.area!).filter(Boolean);

  const [myProspecting, myApproached, myWon, areaTotal] = await Promise.all([
    db.lead.count({ where: { assigneeId: me.id, status: "UNTOUCHED" } }),
    db.lead.count({ where: { assigneeId: me.id, status: { in: APPROACHED } } }),
    db.deal.count({ where: { assignedToId: me.id, status: "CLOSED_WON" } }),
    myAreas.length > 0
      ? db.lead.count({
          where: { area: { in: myAreas }, status: { notIn: ["SKIPPED", "ARCHIVED"] as LeadStatus[] } },
        })
      : Promise.resolve(0),
  ]);

  const coverage = areaTotal > 0 ? Math.round((myApproached / areaTotal) * 1000) / 10 : null;

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl px-5 py-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white/70">あなたの営業（累計）</p>
        {showLink ? (
          <Link
            href="/dashboard/sales"
            className="inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white transition-colors"
          >
            営業フローを開く <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          coverage !== null && (
            <p className="text-[11px] text-white/60">
              担当エリア：{myAreas.slice(0, 3).join("・")}
              {myAreas.length > 3 ? ` 他${myAreas.length - 3}` : ""}
            </p>
          )
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MyStat label="探客中" sub="これから当たる" value={myProspecting} tone="text-sky-300" />
        <MyStat label="アプローチ済み" sub="架電・連絡した" value={myApproached} tone="text-amber-300" />
        <MyStat label="受注" sub="決まった件数" value={myWon} tone="text-emerald-300" />
        <div className="bg-white/5 rounded-lg px-4 py-3">
          <p className="text-[11px] text-white/60">エリア攻略率</p>
          {coverage !== null ? (
            <>
              <p className="text-xl font-bold text-violet-300 mt-0.5">{coverage}%</p>
              <p className="text-[10px] text-white/40 mt-0.5">
                {myApproached} / エリア{areaTotal.toLocaleString()}社
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-white/40 mt-0.5">—</p>
              <p className="text-[10px] text-white/40 mt-0.5">担当リードを持つと表示</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MyStat({
  label,
  sub,
  value,
  tone,
}: {
  label: string;
  sub: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="bg-white/5 rounded-lg px-4 py-3">
      <p className="text-[11px] text-white/60">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${tone}`}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>
    </div>
  );
}
