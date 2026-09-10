import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Mailbox, ChevronLeft } from "lucide-react";
import { prefectureOptions, municipalitiesOf } from "@/lib/packages/tver-area";
import { appUrl } from "@/lib/tver-order/service";
import { DmKitForm } from "@/components/dm/dm-kit-form";
import { DmKitHistory } from "@/components/dm/dm-kit-history";
import { cleanAddress } from "@/lib/dm/address";

export const metadata = { title: "郵送DM | Ad-Arch Group OS" };

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function LeadDmPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);

  const me = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true, groupCompanyId: true, groupCompany: { select: { prefecture: true } } } });
  const leads = idList.length
    ? await db.lead.findMany({ where: { id: { in: idList } }, select: { id: true, name: true, address: true, prefecture: true, industry: true, assigneeId: true, status: true, websiteUrl: true } })
    : [];
  const rows = leads.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    prefecture: l.prefecture,
    industry: l.industry,
    hasPostal: !!cleanAddress(l.address ?? "").postal,
    warn: !l.address ? "住所なし" : l.assigneeId && l.assigneeId !== me?.id && me?.role !== "ADMIN" ? "別担当" : ["SKIPPED", "ARCHIVED", "DEAL_CONVERTED"].includes(l.status) ? "対象外" : null,
  }));

  // 県の初期値: 選んだリードの県（多数決）→ 自拠点の県
  const prefCount = new Map<string, number>();
  for (const l of leads) if (l.prefecture) prefCount.set(l.prefecture, (prefCount.get(l.prefecture) ?? 0) + 1);
  const topPref = [...prefCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? me?.groupCompany?.prefecture ?? "";
  const prefs = prefectureOptions();
  const defaultPref = prefs.find((p) => p === topPref) ?? prefs.find((p) => topPref && p.startsWith(topPref.replace(/[都府県]$/, ""))) ?? "";
  const muniMap: Record<string, { code: string; name: string }[]> = {};
  for (const p of prefs) muniMap[p] = municipalitiesOf(p).map((m) => ({ code: m.code, name: m.name }));
  const industries = [...new Set(leads.map((l) => l.industry).filter((x): x is string => !!x))];
  const defaultLanding = me?.groupCompanyId ? `${appUrl()}/order/tver?from=${me.groupCompanyId}` : `${appUrl()}/order/tver`;

  return (
    <div className="px-6 py-6 max-w-screen-lg mx-auto w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
            <Mailbox className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">郵送DM（チラシDM）</h2>
            <p className="text-xs text-zinc-500 mt-0.5">選んだ会社に紙のチラシを送る材料（宛先CSV・チラシPDF・発送先）を揃えます。発送はあなたが日本郵便のWebレターかラクスルDMから行い、費用は貴社（本部は送りません）</p>
          </div>
        </div>
        <Link href="/dashboard/leads/list" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
          <ChevronLeft className="w-3.5 h-3.5" /> リード管理
        </Link>
      </div>

      {rows.length === 0 ? (
        <>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 space-y-3">
          <p>まず <Link href="/dashboard/leads/list" className="text-blue-700 underline">リード管理</Link> で送りたい会社にチェックを入れ、選択バーの「郵送DMへ」を押してください。</p>
          <ol className="list-decimal pl-5 text-xs text-zinc-500 space-y-1">
            <li>宛先CSV（日本郵便Webレター用・そのままアップロード）と汎用CSVができます</li>
            <li>貴社名入りのA4チラシPDF（TVerチラシの型・LP／申込ページのQR付き）ができます</li>
            <li>発送先のリンクと手順、概算が出ます。発送はあなたが行います（本部は送りません）</li>
            <li>送付として記録され、返事は「返事待ち」で入力できます（メール・フォームと同じ）</li>
          </ol>
          <p className="text-xs text-zinc-400">AI連携（Claude／ChatGPT）からは「◯◯市の◯◯にチラシDMを送りたい」で同じものが作れます。チラシは自作のPDFを上げることもできます。</p>
        </div>
        <DmKitHistory />
        </>
      ) : (
        <DmKitForm leads={rows} prefectures={prefs} municipalities={muniMap} defaultPrefecture={defaultPref} industries={industries} defaultLandingUrl={defaultLanding} />
      )}
    </div>
  );
}
