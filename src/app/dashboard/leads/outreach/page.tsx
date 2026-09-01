import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PenLine } from "lucide-react";
import Link from "next/link";
import type { LeadStatus, LeadSource } from "@/generated/prisma/client";
import { PREFECTURES } from "@/lib/constants/crm";
import { OutreachForm } from "@/components/leads/outreach-form";
import { FavoriteButton } from "@/components/layout/favorite-button";
import { ActivityKpiBar } from "@/components/dashboard/activity-kpi-bar";
import { getActivityKpi } from "@/lib/kpis/activity";
import { FORM_SKIPPED, parseSkipDetail } from "@/lib/constants/outreach-skip";
import { getActivePackagesLite } from "@/lib/packages/query";

const MAX_LEADS = 120;

// 都道府県名を比較用に正規化（都/府/県を落とす。北海道はそのまま）
function normalizePref(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (t.startsWith("北海道")) return "北海道";
  return t.replace(/[都府県]$/, "");
}

// テキストから都道府県を1つ検出
//   パス1: フルネーム（「東京都」等）で照合 → 「京都」が「東京都」に誤一致するのを防ぐ
//   パス2: 接尾辞なしのベース名（「東京」「大阪」等）で照合
const PREF_FULL = [...PREFECTURES].filter((p) => p !== "海外");
function detectPref(text: string): string | null {
  for (const p of PREF_FULL) {
    if (text.includes(p)) return normalizePref(p);
  }
  for (const p of PREF_FULL) {
    const base = normalizePref(p);
    if (base.length >= 2 && text.includes(base)) return base;
  }
  return null;
}

interface PageProps {
  searchParams: Promise<{
    ids?: string;
    q?: string;
    status?: string;
    industry?: string;
    area?: string;
    /** パッケージ画面の「営業フォームで使う」→ 全カードの訴求をこのパッケージにする */
    package?: string;
  }>;
}

export default async function LeadOutreachPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) return null;

  const params = await searchParams;
  // リード管理で「指定（チェック選択）した会社」が渡された場合はそれを最優先
  const idList = (params.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 300);
  const hasIds = idList.length > 0;

  const q = params.q?.trim() ?? "";
  const statusParam = params.status ?? "UNTOUCHED"; // 既定は未対応リードを対象
  const industryParam = params.industry ?? "";
  const areaParam = params.area ?? "";

  // リード管理と同じベース除外（SKIPPED・未claimのPR_TIMESは出さない）
  type WhereInput = {
    id?: { in: string[] };
    OR?: Array<Record<string, unknown>>;
    status?: LeadStatus | { not: LeadStatus };
    industry?: string;
    area?: { contains: string; mode: "insensitive" };
    NOT?: { source: LeadSource; assigneeId: null };
  };
  // ids 指定時は、指定された会社だけを（ステータス等の絞り込みを無視して）対象にする
  let where: WhereInput;
  if (hasIds) {
    where = { id: { in: idList } };
  } else {
    where = {
      status: { not: "SKIPPED" as LeadStatus },
      NOT: { source: "PR_TIMES_TVCM" as LeadSource, assigneeId: null },
    };
    if (statusParam && statusParam !== "all" && statusParam !== "SKIPPED") {
      where.status = statusParam as LeadStatus;
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }
    if (industryParam) where.industry = industryParam;
    if (areaParam) where.area = { contains: areaParam, mode: "insensitive" };
  }

  const [leads, activeCompanies, provenRaw, me, packages] = await Promise.all([
    db.lead.findMany({
      where,
      select: {
        id: true,
        name: true,
        area: true,
        prefecture: true,
        address: true,
        industry: true,
        websiteUrl: true,
        mapsUrl: true,
        phone: true,
        email: true,
        status: true,
        sentAt: true,
        outreachResult: true,
      },
      orderBy: [{ scoreTotal: "desc" }, { createdAt: "desc" }],
      take: hasIds ? idList.length : MAX_LEADS,
    }),
    // 稼働中の代表の所在県（近接判定用）
    db.groupCompany.findMany({
      where: { isActive: true },
      select: { prefecture: true, branchLabels: true },
    }),
    // 結果の出た営業文（商談化・返信あり）
    db.salesApproach.findMany({
      where: { result: { in: ["DEAL", "REPLIED_OK", "REPLIED_NG"] } },
      select: {
        industry: true,
        result: true,
        messageBody: true,
        groupCompany: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    // ログイン中ユーザーの加盟会社（差出人の会社名の既定）＋マイサンプル
    db.user.findUnique({
      where: { email: session.user.email },
      select: {
        groupCompany: { select: { name: true } },
        outreachSamples: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, text: true },
        },
      },
    }),
    // 稼働中のパッケージ（訴求セレクトに価格入りで並ぶ）
    getActivePackagesLite(),
  ]);
  const initialPackageId = params.package && packages.some((p) => p.id === params.package) ? params.package : null;

  // 稼働県セット（正規化）
  const activePrefs = new Set<string>();
  for (const c of activeCompanies) {
    if (c.prefecture) activePrefs.add(normalizePref(c.prefecture));
    for (const b of c.branchLabels) activePrefs.add(normalizePref(b));
  }
  activePrefs.delete("");

  // 既に送付済み（FORM_SENT ログがある）リードID
  const leadIds = leads.map((l) => l.id);
  const sentLogs = leadIds.length
    ? await db.leadLog.findMany({
        where: { leadId: { in: leadIds }, action: "FORM_SENT" },
        select: { leadId: true },
        distinct: ["leadId"],
      })
    : [];
  const sentSet = new Set(sentLogs.map((s) => s.leadId));

  // 送付見送り（FORM_SKIPPED ログ）。1リードにつき最新の1件だけ使う
  const skipLogs = leadIds.length
    ? await db.leadLog.findMany({
        where: { leadId: { in: leadIds }, action: FORM_SKIPPED },
        select: { leadId: true, detail: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const skipMap = new Map<string, { reasonLabel: string; note: string }>();
  for (const s of skipLogs) {
    if (skipMap.has(s.leadId)) continue;
    const parsed = parseSkipDetail(s.detail);
    if (parsed) skipMap.set(s.leadId, parsed);
  }

  // クライアントへ渡す形に整形
  const formLeads = leads.map((l) => {
    const text = `${l.prefecture ?? ""} ${l.area ?? ""} ${l.address ?? ""}`;
    const pref = detectPref(text);
    const nearbyPref = pref && activePrefs.has(pref) ? pref : null;
    return {
      id: l.id,
      name: l.name,
      area: l.area ?? l.prefecture ?? "",
      industry: l.industry ?? "",
      websiteUrl: l.websiteUrl ?? null,
      mapsUrl: l.mapsUrl ?? null,
      phone: l.phone ?? null,
      email: l.email ?? null,
      nearbyPref,
      alreadySent: sentSet.has(l.id),
      sentAt: l.sentAt ? l.sentAt.toISOString() : null,
      outreachResult: l.outreachResult,
      skip: skipMap.get(l.id) ?? null,
    };
  });

  // 結果の出た文面（本文は長すぎる場合だけ切り詰め）
  const provenCopies = provenRaw.map((p) => ({
    industry: p.industry,
    result: p.result as "DEAL" | "REPLIED_OK" | "REPLIED_NG",
    company: p.groupCompany?.name ?? "",
    body: p.messageBody.length > 2400 ? p.messageBody.slice(0, 2400) + "…" : p.messageBody,
  }));

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1F3A5F]/10 rounded-xl flex items-center justify-center">
            <PenLine className="text-[#1F3A5F]" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-zinc-900">アウトリーチ／営業フォーム（OS連携）</h2>
              <FavoriteButton path="/dashboard/leads/outreach" label="アウトリーチ／営業フォーム" />
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              訴求を選ぶと営業文が自動生成。メールアドレスがある会社は各カードの「メールで送る↗」から下書きが開きます。送付済みにするとOSへ自動反映されます。
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/leads/list"
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-2 whitespace-nowrap mt-1"
        >
          リード管理へ戻る
        </Link>
      </div>

      <ActivityKpiBar kpi={await getActivityKpi()} />

      <OutreachForm
        leads={formLeads}
        provenCopies={provenCopies}
        senderName={session.user.name ?? "白川 裕喜"}
        senderEmail={session.user.email}
        senderCompany={me?.groupCompany?.name ?? "Ad Arch株式会社"}
        initialSamples={me?.outreachSamples ?? []}
        packages={packages}
        initialPackageId={initialPackageId}
      />
    </div>
  );
}
