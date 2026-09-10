import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft, Download, ExternalLink, Brain, Settings2 } from "lucide-react";
import { AskPanel } from "@/components/knowledge/ask-panel";
import { OriginBadge } from "@/components/knowledge/origin-badge";
import { KnowledgeFullText } from "@/components/knowledge/full-text";
import { ORIGIN_UI, STATUS_UI } from "@/components/knowledge/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KnowledgeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const isAdmin = session.user.role === "ADMIN";

  const row = await db.knowledgeSource.findUnique({ where: { id } });
  if (!row) notFound();
  if (!isAdmin && (row.hqOnly || row.status !== "READY")) notFound();

  const fmt = (d: Date) => new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(d));
  const o = ORIGIN_UI[row.origin];
  const st = STATUS_UI[row.status];

  return (
    <div className="px-6 py-6 max-w-screen-lg mx-auto w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/dashboard/knowledge" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
          <ChevronLeft className="w-3.5 h-3.5" /> 資料ライブラリ
        </Link>
        {isAdmin && (
          <Link href={`/dashboard/admin/knowledge?focus=${row.id}`} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline">
            <Settings2 className="w-3.5 h-3.5" /> 本部で編集
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
            <Brain className="text-amber-600" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <OriginBadge origin={row.origin} />
              {row.hqOnly && <span className="text-[10px] px-1.5 rounded border border-zinc-300 text-zinc-500">本部限定</span>}
              {isAdmin && <span className={`text-[10px] px-1.5 rounded border ${st.cls}`}>{st.label}</span>}
            </div>
            <h1 className="text-lg font-bold text-zinc-900 mt-1">{row.title}</h1>
            <p className="text-xs text-zinc-500 mt-1">
              {row.publisher ? `発行元: ${row.publisher}` : ""}{row.publishedAt ? ` ／ ${row.publishedAt}` : ""}{row.pageCount ? ` ／ ${row.pageCount}ページ` : ""} ／ 登録 {fmt(row.createdAt)}（{row.createdByName}）
            </p>
            <p className="text-[11px] mt-1.5 text-zinc-600">
              <span className={`font-bold ${row.origin === "OWN" ? "text-emerald-700" : "text-amber-700"}`}>{o.label}</span>：{o.hint}
              {row.origin === "EXTERNAL" && "。販売価格はTVerシミュレーター／パッケージ台帳で確認"}
            </p>
            {row.note && <p className="text-xs text-zinc-700 mt-2 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">本部メモ: {row.note}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs">
              {row.fileUrl && (
                <a href={row.fileUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900">
                  <Download className="w-3.5 h-3.5" /> 原本（{row.fileName}）
                </a>
              )}
              {row.sourceUrl && (
                <a href={row.sourceUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-zinc-600 hover:text-zinc-900">
                  <ExternalLink className="w-3.5 h-3.5" /> 元のページ
                </a>
              )}
            </div>
          </div>
        </div>
        {row.status === "FAILED" && <p className="text-xs text-rose-600">取り込みに失敗: {row.errorMessage}</p>}
        {row.status === "PENDING" && <p className="text-xs text-sky-700">整理中です（数十秒〜数分）。しばらくして開き直してください</p>}
      </div>

      {row.status === "READY" && <AskPanel sourceIds={[row.id]} compact placeholder="この資料について聞く（例: 最小出稿額は？／配信エリアの指定はどこまで？）" />}

      {row.summary && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-xs font-bold text-zinc-500 mb-1">要約</p>
          <p className="text-sm text-zinc-800">{row.summary}</p>
          {row.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {row.keywords.map((k) => (
                <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">{k}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {row.digest && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5">
          <p className="text-xs font-bold text-amber-800 mb-2">AIの整理：何が使えて、何が参考どまりか</p>
          <div className="prose prose-sm max-w-none prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1 prose-li:my-0.5 text-zinc-800">
            <ReactMarkdown>{row.digest}</ReactMarkdown>
          </div>
        </div>
      )}

      {row.content && <KnowledgeFullText content={row.content} charCount={row.charCount} />}
    </div>
  );
}
