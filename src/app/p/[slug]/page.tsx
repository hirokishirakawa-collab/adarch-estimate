// ==============================================================
// パッケージの公開ページ（お客様向け・ログイン不要）  /p/<slug>?from=<加盟会社ID>
//   ・稼働中のパッケージだけ出す。提案中・終了は 404
//   ・?from= を付けると、その拠点が差出人として出る（会社名・代表者・連絡先）。無ければ本部
//   ・載せるのは相手が読むものだけ。規定・営業文・切り口・分担の内部名は出さない
//   ・proxy.ts の matcher は p/ を除外済み＝認証を通らない
// ==============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  CLIENT_OWNER_LABEL,
  HQ_CONTACT,
  formatPackagePrice,
  parseDeliverables,
  parseFulfillment,
  parseOptions,
  yen,
} from "@/lib/packages/types";
import { TVER_AREA_CALCULATOR } from "@/lib/packages/tver-area";
import { TverAreaCalculator } from "@/components/packages/tver-area-calculator";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; pref?: string; city?: string }> };

async function loadPackage(slug: string) {
  const p = await db.salesPackage.findUnique({ where: { slug } });
  return p && p.status === "ACTIVE" ? p : null;
}

async function loadSender(from?: string) {
  if (!from) return null;
  try {
    const gc = await db.groupCompany.findFirst({
      where: { id: from, isActive: true },
      select: {
        name: true,
        ownerName: true,
        prefecture: true,
        websiteUrl: true,
        linkedUsers: { where: { isActive: true }, select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    });
    if (!gc) return null;
    return { company: gc.name, person: gc.ownerName, prefecture: gc.prefecture, website: gc.websiteUrl, email: gc.linkedUsers[0]?.email ?? null };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await loadPackage(slug);
  if (!p) return { title: "ページが見つかりません" };
  const desc = p.tagline ?? p.summary?.slice(0, 90) ?? "";
  return {
    title: `${p.name}｜Ad Arch Group`,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: { title: p.name, description: desc, type: "website", siteName: "Ad Arch Group" },
  };
}

export default async function PublicPackagePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { from, pref, city } = await searchParams;
  const [p, sender] = await Promise.all([loadPackage(slug), loadSender(from)]);
  if (!p) notFound();

  const deliverables = parseDeliverables(p.deliverables);
  const options = parseOptions(p.options);
  const flow = parseFulfillment(p.fulfillment);
  const price = formatPackagePrice(p);
  const contactEmail = sender?.email ?? HQ_CONTACT.email;
  const contactName = sender ? `${sender.company}${sender.person ? `　${sender.person}` : ""}` : HQ_CONTACT.company;
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(`【${p.name}】について相談したい`)}&body=${encodeURIComponent(`${contactName} 様\n\n${p.name}のページを拝見しました。\n以下について相談させてください。\n\n会社名：\nご担当者：\nお電話：\nご希望の時期：\nご相談内容：\n`)}`;

  return (
    <main className="min-h-screen bg-white text-zinc-900" style={{ fontFamily: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif' }}>
      {/* 上部バー */}
      <div className="border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.2em] text-zinc-500">AD ARCH GROUP</span>
          {sender && <span className="text-[11px] text-zinc-500 truncate ml-3">{sender.company}{sender.prefecture ? `（${sender.prefecture}）` : ""}</span>}
        </div>
      </div>

      {/* ヒーロー */}
      {p.imageUrl && (
        <div className="max-w-3xl mx-auto px-5 pt-6">
          <div className="aspect-[3/2] sm:aspect-[21/9] rounded-2xl overflow-hidden bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
          </div>
        </div>
      )}
      <header className={`max-w-3xl mx-auto px-5 ${p.imageUrl ? "pt-6" : "pt-10"} pb-8`}>
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#F19834]">{p.category.toUpperCase()} PACKAGE</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mt-2">{p.name}</h1>
        {p.tagline && <p className="text-base sm:text-lg text-zinc-600 mt-3">{p.tagline}</p>}
        <div className="mt-6 inline-flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-2xl border-2 border-[#F19834] bg-[#FFF6EA] px-6 py-4">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#B8651A]">PRICE</span>
          <span className="text-3xl font-extrabold tabular-nums">{price}</span>
          <span className="text-xs text-zinc-500">税抜{p.priceNote ? `／${p.priceNote}` : ""}</span>
        </div>
        {p.leadTime && <p className="text-sm text-zinc-600 mt-3">納期の目安：{p.leadTime}</p>}
        <div className="mt-6">
          <a href={mailto} className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#F19834] text-white font-bold text-base hover:bg-[#d9821f] transition-colors">
            このパッケージについて相談する
          </a>
          <p className="text-[11px] text-zinc-400 mt-2">メールが開きます。お電話でも承ります。</p>
        </div>
      </header>

      <div className="h-px bg-gradient-to-r from-[#F19834] via-[#F19834]/40 to-transparent" />

      {/* 本文 */}
      <div className="max-w-3xl mx-auto px-5 py-10 space-y-12">
        {p.calculator === TVER_AREA_CALCULATOR && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-3">御社のエリアだと、いくらで何人に届くか</h2>
            <TverAreaCalculator pref={pref} city={city} fallbackPref={sender?.prefecture} />
          </section>
        )}

        {p.painPoints && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-3">こんな方に</h2>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{p.painPoints}</p>
            {p.targetIndustries.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {p.targetIndustries.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700">{t}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {p.summary && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-3">このパッケージでできること</h2>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{p.summary}</p>
          </section>
        )}

        {deliverables.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-3">お届けするもの</h2>
            <ul className="divide-y divide-zinc-100 border-y border-zinc-100">
              {deliverables.map((d, i) => (
                <li key={i} className="py-3.5 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold">{d.name}</p>
                    {d.spec && <p className="text-sm text-zinc-500 mt-0.5">{d.spec}</p>}
                  </div>
                  <span className="text-sm text-zinc-600 tabular-nums whitespace-nowrap pt-0.5">{d.qty}{d.unit}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {flow.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-3">進め方</h2>
            <ol className="space-y-3">
              {flow.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#1F3A5F] text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="pt-1">
                    <p className="text-[15px] font-medium">{f.task}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{CLIENT_OWNER_LABEL[f.owner]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {options.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-3">追加オプション</h2>
            <ul className="space-y-2">
              {options.map((o, i) => (
                <li key={i} className="rounded-xl border border-zinc-200 px-4 py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{o.name}</p>
                    {o.note && <p className="text-sm text-zinc-500 mt-0.5">{o.note}</p>}
                  </div>
                  {o.price != null && <span className="text-sm font-bold tabular-nums whitespace-nowrap">{yen(o.price)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.caseStudies && (
          <section>
            <h2 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mb-3">事例</h2>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{p.caseStudies}</p>
          </section>
        )}

        {/* CTA */}
        <section className="rounded-2xl bg-[#1F3A5F] text-white px-6 py-8 text-center">
          <p className="text-lg font-bold">まずは、御社の状況をお聞かせください</p>
          <p className="text-sm text-white/80 mt-2">内容と価格を固定したパッケージです。御社に合わせた調整もご相談ください。</p>
          <a href={mailto} className="inline-flex items-center justify-center mt-5 px-8 py-3.5 rounded-xl bg-[#F19834] text-white font-bold hover:bg-[#d9821f] transition-colors">
            相談する（メール）
          </a>
          <div className="mt-6 text-sm text-white/90">
            <p className="font-bold">{contactName}</p>
            <p className="text-white/70 mt-0.5">
              {contactEmail}
              {!sender && <>　／　{HQ_CONTACT.phone}</>}
            </p>
            {sender?.website && (
              <a href={sender.website} target="_blank" rel="noopener noreferrer" className="text-white/70 underline underline-offset-2 text-xs mt-1 inline-block">
                {sender.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </section>
      </div>

      <footer className="border-t border-zinc-100">
        <div className="max-w-3xl mx-auto px-5 py-6 text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2">
          <span>Ad Arch Group{sender ? `／${sender.company}` : `／${HQ_CONTACT.company}`}</span>
          <span>価格はすべて税抜表示です</span>
        </div>
      </footer>
    </main>
  );
}
