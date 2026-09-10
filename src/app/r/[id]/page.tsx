// ==============================================================
// セミナー録画の公開視聴ページ（お客様向け・ログイン不要）  /r/<id>?from=<加盟会社ID>
//   ・登壇者名と登壇会社は必ず出す（本人の看板）
//   ・?from= を付けると、その拠点が「窓口」として出る（予約リンク・LINE友だち追加・メール）。無ければ本部
//   ・金額は出さない。数字はOSの公開ページへ
//   ・proxy.ts の matcher は r/ を除外済み＝認証を通らない
// ==============================================================

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { HQ_CONTACT } from "@/lib/packages/types";
import { parseVideoUrl } from "@/lib/seminars/video";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

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
        linkedUsers: { where: { isActive: true }, select: { email: true, branchId: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    });
    if (!gc) return null;
    const u = gc.linkedUsers[0];
    let lineUrl: string | null = null;
    let bookingUrl: string | null = null;
    if (u?.branchId) {
      const la = await db.lineAccount.findFirst({ where: { branchId: u.branchId, isActive: true }, select: { id: true, basicId: true }, orderBy: { createdAt: "asc" } });
      if (la?.basicId) lineUrl = `https://line.me/R/ti/p/${la.basicId.startsWith("@") ? la.basicId : `@${la.basicId}`}`;
      if (la) {
        const bt = await db.bookingType.findFirst({ where: { lineAccountId: la.id, isActive: true }, select: { slug: true }, orderBy: { createdAt: "asc" } });
        if (bt) bookingUrl = `/book/${bt.slug}`;
      }
    }
    return { company: gc.name, person: gc.ownerName, prefecture: gc.prefecture, website: gc.websiteUrl, email: u?.email ?? null, lineUrl, bookingUrl };
  } catch {
    return null;
  }
}

async function loadRecording(id: string) {
  const r = await db.seminarRecording.findUnique({ where: { id } });
  if (!r || !r.isActive) return null;
  return r;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const r = await loadRecording(id);
  if (!r) return { title: "ページが見つかりません" };
  return {
    title: `${r.title}｜Ad Arch Group`,
    description: r.summary?.slice(0, 90) ?? `${r.presenterName}（${r.ownerCompany}）のセミナー録画`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicRecordingPage({ params, searchParams }: Params) {
  const { id } = await params;
  const { from } = await searchParams;
  const [r, sender] = await Promise.all([loadRecording(id), loadSender(from)]);
  if (!r) notFound();
  db.seminarRecording.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const info = parseVideoUrl(r.videoUrl);
  const contactCompany = sender ? `${sender.company}${sender.person && !sender.company.includes(sender.person) ? `　${sender.person}` : ""}` : HQ_CONTACT.company;
  const contactEmail = sender?.email ?? HQ_CONTACT.email;
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(`「${r.title}」を見て相談したい`)}`;
  const recorded = r.recordedAt ? r.recordedAt.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <main className="min-h-screen bg-white text-zinc-900" style={{ fontFamily: '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif' }}>
      <div className="border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.2em] text-zinc-500">AD ARCH GROUP</span>
          {sender && <span className="text-[11px] text-zinc-500 truncate ml-3">{sender.company}{sender.prefecture ? `（${sender.prefecture}）` : ""}</span>}
        </div>
      </div>

      <header className="max-w-3xl mx-auto px-5 pt-8 pb-5">
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#F19834]">SEMINAR RECORDING</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mt-2">{r.title}</h1>
        <p className="text-sm text-zinc-600 mt-2">
          登壇：{r.presenterName}（{r.ownerCompany}{r.prefecture ? `・${r.prefecture}` : ""}）
          {r.durationMin ? `　／　約${r.durationMin}分` : ""}
          {recorded ? `　／　${recorded}` : ""}
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-5">
        {info.embedUrl ? (
          <div className="aspect-video rounded-2xl overflow-hidden bg-zinc-900">
            <iframe src={info.embedUrl} title={r.title} className="w-full h-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        ) : (
          <a href={info.watchUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border-2 border-[#F19834] bg-[#FFF6EA] px-6 py-8 text-center font-bold">
            動画を開く（別ウィンドウ）
          </a>
        )}
        {r.summary && <p className="text-sm sm:text-base text-zinc-700 mt-6 whitespace-pre-line leading-relaxed">{r.summary}</p>}
      </div>

      <div className="max-w-3xl mx-auto px-5 mt-10">
        <div className="h-px bg-gradient-to-r from-[#F19834] via-[#F19834]/40 to-transparent" />
      </div>

      {/* 窓口 */}
      <section className="max-w-3xl mx-auto px-5 py-10">
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#B8651A]">CONTACT</p>
        <h2 className="text-xl font-extrabold mt-2">見終わったら、30分の個別相談へ</h2>
        <p className="text-sm text-zinc-600 mt-2">貴社の商圏（市）でどのくらい届くか、その場で数字を出します。費用は相談のあとで。</p>
        <p className="text-sm font-bold text-zinc-800 mt-4">{contactCompany}</p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          {sender?.bookingUrl && (
            <a href={sender.bookingUrl} className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[#F19834] text-white font-bold text-base hover:bg-[#d9821f] transition-colors">
              日時を選んで相談を予約する
            </a>
          )}
          {sender?.lineUrl && (
            <a href={sender.lineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[#06C755] text-white font-bold text-base hover:bg-[#05b34c] transition-colors">
              LINEで友だち追加して相談する
            </a>
          )}
          <a href={mailto} className={`inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-bold text-base transition-colors ${sender?.bookingUrl || sender?.lineUrl ? "border border-zinc-300 text-zinc-800 hover:bg-zinc-50" : "bg-[#F19834] text-white hover:bg-[#d9821f]"}`}>
              メールで相談する
          </a>
        </div>
        {!sender && <p className="text-[11px] text-zinc-400 mt-3">{HQ_CONTACT.phone}（お電話でも承ります）</p>}
        {sender?.website && (
          <a href={sender.website} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 underline underline-offset-2 mt-3 inline-block">
            {sender.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </section>

      <footer className="border-t border-zinc-100">
        <div className="max-w-3xl mx-auto px-5 py-5 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Ad Arch Group{sender ? `／${sender.company}` : `／${HQ_CONTACT.company}`}</span>
          <span>この動画は上記の窓口からのご案内です</span>
        </div>
      </footer>
    </main>
  );
}
