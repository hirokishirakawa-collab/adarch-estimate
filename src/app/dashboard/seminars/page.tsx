import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Video, Plus, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { issuer } from "@/lib/oauth/server";
import { parseVideoUrl } from "@/lib/seminars/video";
import { createRecording, deactivateRecording } from "./actions";
import { CopyText } from "./CopyText";

/** セミナー録画ライブラリ（グループ全社共有）。誰の録画でも、自社の窓口付きリンクで送れる */
export default async function SeminarsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const email = session.user.email ?? "";
  const [me, base, list] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { role: true, name: true, groupCompanyId: true, groupCompany: { select: { name: true } } } }),
    issuer(),
    db.seminarRecording.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const isAdmin = me?.role === "ADMIN";
  const from = me?.groupCompanyId ? `?from=${me.groupCompanyId}` : "";
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }) : null);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center">
          <Video className="text-orange-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">セミナー録画ライブラリ（全社共有）</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            各社のセミナー録画をグループで共有。誰の録画でも「貴社の窓口付き」の視聴リンクで送れます。登壇者名は必ず出ます。
          </p>
        </div>
      </div>

      {/* 登録 */}
      <details className="bg-white border border-zinc-200 rounded-xl">
        <summary className="cursor-pointer px-5 py-3.5 text-sm font-bold text-zinc-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-orange-600" />
          録画を登録する（YouTubeの限定公開URL）
        </summary>
        <form action={createRecording} className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-zinc-600 sm:col-span-2">
            題名 <span className="text-red-500">*</span>
            <input name="title" required maxLength={120} placeholder="例: 地元の飲食店のためのTVer広告 30分" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-zinc-600 sm:col-span-2">
            動画URL <span className="text-red-500">*</span>（YouTube「限定公開」推奨。URLを知っている人だけが見られます）
            <input name="videoUrl" required type="url" placeholder="https://youtu.be/…" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-zinc-600">
            登壇者名（空なら {me?.name ?? email}）
            <input name="presenterName" maxLength={60} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-zinc-600">
            誰向けか
            <input name="audience" maxLength={80} placeholder="例: 商圏が市内の飲食店・美容室" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-zinc-600">
            長さ（分）
            <input name="durationMin" type="number" min={1} max={600} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-zinc-600">
            開催日
            <input name="recordedAt" type="date" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-zinc-600 sm:col-span-2">
            内容の一言（3行まで）
            <textarea name="summary" rows={3} maxLength={600} placeholder="何を話しているか。相手が見る前に読む文" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">登録した瞬間からグループ全社が使えます。登録者は {me?.groupCompany?.name ?? "Ad Arch本部"} として表示されます。</p>
            <button type="submit" className="rounded-lg bg-orange-600 text-white px-4 py-2 text-sm font-bold hover:bg-orange-700">登録する</button>
          </div>
        </form>
      </details>

      {/* 一覧 */}
      {list.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-300 rounded-xl p-8 text-center text-sm text-zinc-500">まだ録画がありません。最初の1本を登録してください。</div>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const link = `${base}/r/${r.id}${from}`;
            const info = parseVideoUrl(r.videoUrl);
            const lineText = `【録画のご案内】${r.title}\n${r.presenterName}（${r.ownerCompany}）が話した${r.durationMin ? `${r.durationMin}分の` : ""}セミナーです。${r.audience ? `${r.audience}向け。` : ""}\nこちらから見られます → ${link}\n見終わったら、30分の個別相談も承ります。`;
            const mine = r.ownerEmail === email;
            return (
              <li key={r.id} className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
                <div className="sm:w-56 shrink-0">
                  {info.embedUrl ? (
                    <div className="aspect-video rounded-lg overflow-hidden bg-zinc-100">
                      <iframe src={info.embedUrl} title={r.title} className="w-full h-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
                    </div>
                  ) : (
                    <a href={info.watchUrl} target="_blank" rel="noopener noreferrer" className="aspect-video rounded-lg bg-zinc-100 flex items-center justify-center text-xs text-zinc-500">動画を開く</a>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-900">{r.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    登壇 {r.presenterName}（{r.ownerCompany}{r.prefecture ? `・${r.prefecture}` : ""}）
                    {r.durationMin ? `　／　${r.durationMin}分` : ""}
                    {fmt(r.recordedAt) ? `　／　${fmt(r.recordedAt)}` : ""}
                    {r.audience ? `　／　${r.audience}向け` : ""}
                    　／　視聴 {r.viewCount}回
                  </p>
                  {r.summary && <p className="text-xs text-zinc-700 mt-2 whitespace-pre-line leading-relaxed">{r.summary}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="text-[11px] bg-[#f7f6f4] border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-700 select-all break-all">{link}</code>
                    <CopyText text={link} label="視聴リンクをコピー" />
                    <CopyText text={lineText} label="LINE・メール用の文面をコピー" />
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900">
                      <ExternalLink className="w-3.5 h-3.5" />
                      視聴ページを見る
                    </a>
                    {(mine || isAdmin) && (
                      <form action={deactivateRecording} className="ml-auto">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-xs text-zinc-500 hover:text-red-600">取り下げる</button>
                      </form>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2">
                    {from ? "このリンクは貴社の窓口（予約・LINE・メール）付きで開きます。" : "本部の窓口付きで開きます。加盟会社の紐づけがある方は自社の窓口になります。"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="bg-[#f7f6f4] rounded-xl px-5 py-3.5 text-xs text-zinc-600 leading-relaxed">
        <span className="font-bold text-zinc-800">使い方　</span>
        LINEのステップ配信・一斉配信、メール、DMの本文に「視聴リンク」を貼るだけ。開いた人は録画の下に貴社の予約リンクとLINE友だち追加が出ます。転送されても窓口は貴社のままです。金額は録画の中でも言わないでください（数字はOSの公開ページへ）。
      </div>
    </div>
  );
}
