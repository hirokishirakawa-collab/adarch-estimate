import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Calculator, FileDown, MessageCircle, PenLine, Pencil } from "lucide-react";
import { PackageShareLink } from "@/components/packages/share-link";
import { TverAreaCalculator } from "@/components/packages/tver-area-calculator";
import { TVER_AREA_CALCULATOR } from "@/lib/packages/tver-area";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPackageApproaches, getPackageBySlug, getPackageStats } from "@/lib/packages/query";
import {
  formatPackagePrice,
  hasPrice,
  OWNER_LABEL,
  packageImageSrc,
  parseDeliverables,
  parseDocs,
  parseFulfillment,
  parseOptions,
  STATUS_LABEL,
  yen,
} from "@/lib/packages/types";
import { PackageStatusActions } from "@/components/packages/package-status-actions";
import { CopyTextButton } from "@/components/packages/copy-text-button";
import { LinkedChat } from "@/components/office/linked-chat";
import type { SalesPackageStatus, SalesApproachResult } from "@/generated/prisma/client";

const STATUS_CHIP: Record<SalesPackageStatus, string> = {
  PROPOSED: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  RETIRED: "bg-zinc-200 text-zinc-600",
};
const RESULT_LABEL: Record<SalesApproachResult, string> = {
  DEAL: "受注・商談化",
  REPLIED_OK: "返信あり（前向き）",
  REPLIED_NG: "返信あり（不成立）",
  NO_REPLY: "無反応",
  REJECTED: "断り",
};

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-zinc-200">
      <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h3>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
const Empty = ({ text = "未記入" }: { text?: string }) => <p className="text-sm text-zinc-400">{text}</p>;
const Pre = ({ text }: { text: string | null }) => (text ? <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{text}</p> : <Empty />);

export default async function PackageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pref?: string; city?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/");
  const { slug } = await params;
  const sp = await searchParams;
  const [me, pkg] = await Promise.all([
    db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, groupCompanyId: true, groupCompany: { select: { prefecture: true } } },
    }),
    getPackageBySlug(slug),
  ]);
  if (!pkg || !me) notFound();

  // 公開ページのURL（差出人＝見ている人の加盟会社。本部は from なし）
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const publicUrl = `${proto}://${host}/p/${pkg.slug}${me.groupCompanyId ? `?from=${me.groupCompanyId}` : ""}`;
  const isAdmin = me.role === "ADMIN";
  const mine = pkg.proposedById === me.id;
  const canEdit = isAdmin || (mine && pkg.status === "PROPOSED");

  const [stats, approaches] = await Promise.all([getPackageStats([pkg.id]), getPackageApproaches(pkg.id)]);
  const s = stats[pkg.id];
  const deliverables = parseDeliverables(pkg.deliverables);
  const options = parseOptions(pkg.options);
  const flow = parseFulfillment(pkg.fulfillment);
  const docs = parseDocs(pkg.docs);
  const active = pkg.status === "ACTIVE";
  const pitch = pkg.pitchText ?? "";

  return (
    <div className="px-6 py-6 space-y-5 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/packages" className="hover:text-zinc-800">パッケージ</Link>
        <span>/</span>
        <span className="text-zinc-400">{pkg.name}</span>
      </div>

      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-orange-200 p-5">
        <div className="flex flex-wrap items-start gap-4">
          {packageImageSrc(pkg) && (
            <div className="w-full sm:w-56 aspect-[3/2] rounded-lg overflow-hidden bg-zinc-100 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={packageImageSrc(pkg)!} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-widest text-orange-600">{pkg.category}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[pkg.status]}`}>{STATUS_LABEL[pkg.status]}</span>
              {pkg.targetIndustries.map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{t}</span>
              ))}
            </div>
            <h2 className="text-2xl font-extrabold text-zinc-900 mt-1.5">{pkg.name}</h2>
            {pkg.tagline && <p className="text-sm text-zinc-600 mt-0.5">{pkg.tagline}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-zinc-900 tabular-nums">{formatPackagePrice(pkg)}</p>
            <p className="text-[11px] text-zinc-500">税抜{pkg.priceNote ? `／${pkg.priceNote}` : ""}{pkg.leadTime ? `／納期 ${pkg.leadTime}` : ""}</p>
          </div>
        </div>

        {/* 売る動線（稼働中だけ） */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {active ? (
            <>
              <Link href={`/dashboard/leads/outreach?package=${pkg.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1F3A5F] rounded-lg hover:bg-[#16304f]">
                <PenLine className="w-3.5 h-3.5" />営業フォームで使う
              </Link>
              <Link href={`/dashboard/estimates/new?package=${pkg.slug}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700">
                <Calculator className="w-3.5 h-3.5" />この内容で見積を作る
              </Link>
              <a href={`/api/packages/${pkg.slug}/pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50">
                <FileDown className="w-3.5 h-3.5" />お客様向け資料（A4）
              </a>
            </>
          ) : (
            <>
              <span className="text-xs text-zinc-500">{pkg.status === "PROPOSED" ? "提案中＝まだ売り物ではありません。本部が承認すると営業フォーム・見積に並びます。" : "終了したパッケージです。記録として残っています。"}</span>
              {isAdmin && pkg.status === "PROPOSED" && (
                <>
                  <a href={`/p/${pkg.slug}?preview=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">
                    公開ページを下書きで確認
                  </a>
                  <a href={`/api/packages/${pkg.slug}/pdf?preview=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">
                    <FileDown className="w-3.5 h-3.5" />資料を下書きで確認
                  </a>
                </>
              )}
            </>
          )}
          <Link href={`/dashboard/live?ref=package:${pkg.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
            <MessageCircle className="w-3.5 h-3.5" />チャットでこれについて聞く
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <Link href={`/dashboard/packages/${pkg.slug}/edit`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50">
                <Pencil className="w-3.5 h-3.5" />編集
              </Link>
            )}
            <PackageStatusActions id={pkg.id} status={pkg.status} isAdmin={isAdmin} canDelete={isAdmin || (mine && pkg.status === "PROPOSED")} hasPrice={hasPrice(pkg)} />
          </div>
        </div>

        {active && <PackageShareLink url={publicUrl} />}

        {/* 実績 */}
        <div className="mt-4 grid grid-cols-3 gap-2 max-w-md">
          {[
            { l: "送付", v: s?.sent ?? 0, c: "text-zinc-900" },
            { l: "返信", v: s?.replied ?? 0, c: "text-zinc-900" },
            { l: "受注", v: s?.won ?? 0, c: "text-emerald-700" },
          ].map((x) => (
            <div key={x.l} className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2">
              <p className="text-[10px] text-zinc-500">{x.l}</p>
              <p className={`text-lg font-extrabold tabular-nums ${x.c}`}>{x.v}</p>
            </div>
          ))}
        </div>
      </div>

      {pkg.calculator === TVER_AREA_CALCULATOR && (
        <Section title="エリア別の目安（市を選ぶと、月額ごとの到達人数・住民の何%か）">
          <TverAreaCalculator pref={sp.pref} city={sp.city} fallbackPref={me.groupCompany?.prefecture} compact />
        </Section>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="こんな方に（想定顧客の悩み）"><Pre text={pkg.painPoints} /></Section>
        <Section title="概要（何が届くか）"><Pre text={pkg.summary} /></Section>

        <Section title="届くもの">
          {deliverables.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {deliverables.map((d, i) => (
                <li key={i} className="py-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{d.name}</p>
                    {d.spec && <p className="text-xs text-zinc-500">{d.spec}</p>}
                  </div>
                  <span className="text-sm text-zinc-600 tabular-nums whitespace-nowrap">{d.qty}{d.unit}</span>
                </li>
              ))}
            </ul>
          )}
          {options.length > 0 && (
            <div className="mt-3 pt-3 border-t border-dashed border-zinc-200">
              <p className="text-[11px] font-semibold text-zinc-500 mb-1">追加オプション</p>
              <ul className="space-y-1">
                {options.map((o, i) => (
                  <li key={i} className="text-sm text-zinc-700">
                    <b>{o.name}</b>{o.price != null && <span className="ml-2 tabular-nums">{yen(o.price)}</span>}
                    {o.note && <span className="text-xs text-zinc-500 ml-2">{o.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="分担（誰が何をやるか）">
          {flow.length === 0 ? (
            <Empty />
          ) : (
            <ol className="space-y-1.5">
              {flow.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1F3A5F] text-white whitespace-nowrap mt-0.5">{OWNER_LABEL[f.owner]}</span>
                  <span className="text-zinc-800">{f.task}{f.note && <span className="text-xs text-zinc-500 ml-1.5">{f.note}</span>}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <div className="lg:col-span-2">
          <Section title="営業文（フォーム営業向け）" aside={pitch ? <CopyTextButton text={pitch.replace(/\{name\}/g, "貴社")} label="コピー（{name}→貴社）" /> : undefined}>
            <Pre text={pitch || null} />
          </Section>
        </div>
        <Section title="商談の切り口"><Pre text={pkg.talkTrack} /></Section>
        <Section title="統一規定（値引き・名称・言ってはいけないこと）"><Pre text={pkg.rules} /></Section>
        <Section title="成功事例"><Pre text={pkg.caseStudies} /></Section>
        <Section title="資料">
          {docs.length === 0 ? (
            <Empty text="資料リンクはまだありません" />
          ) : (
            <ul className="space-y-1">
              {docs.map((d, i) => (
                <li key={i}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{d.title} ↗</a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* 起案情報 */}
      <Section title="起案">
        <p className="text-xs text-zinc-500">
          起案: {pkg.proposedBy ? `${pkg.proposedBy.name ?? pkg.proposedBy.email}${pkg.proposedBy.groupCompany ? `（${pkg.proposedBy.groupCompany.name}）` : ""}` : "本部"}
          　{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(pkg.createdAt)}
          {pkg.approvedAt && <>　／　承認 {new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(pkg.approvedAt)}</>}
        </p>
        {pkg.proposalNote && <p className="text-sm text-zinc-700 mt-2 whitespace-pre-wrap">{pkg.proposalNote}</p>}
      </Section>

      {/* このパッケージで当たった事例 */}
      <Section title={`このパッケージで当たった事例（${approaches.length}${approaches.length >= 8 ? "+" : ""}）`}>
        {approaches.length === 0 ? (
          <Empty text="まだ送付の記録がありません。営業フォームでこのパッケージを選んで送ると、結果がここに溜まります。" />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {approaches.map((a) => (
              <li key={a.id} className="py-2 text-sm flex items-start gap-3">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${a.result === "DEAL" ? "bg-emerald-600 text-white" : a.result === "REPLIED_OK" ? "bg-teal-600 text-white" : "bg-zinc-200 text-zinc-600"}`}>{RESULT_LABEL[a.result]}</span>
                <span className="text-zinc-800">{a.industry}{a.targetDesc ? `／${a.targetDesc}` : ""}<span className="text-xs text-zinc-500 ml-2">{a.groupCompany.name}</span></span>
                {a.learnings && <span className="text-xs text-zinc-500 ml-auto max-w-[40%] truncate">{a.learnings}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <LinkedChat kind="package" id={pkg.id} title={pkg.name} />
      </div>
    </div>
  );
}
