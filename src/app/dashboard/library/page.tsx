import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { searchWorkspaceLibrary } from "@/lib/workspace/library-search";
import type { UserRole } from "@/types/roles";
import { AiWorkButton } from "@/components/workspace/ai-work-button";
export default async function LibrarySearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const input = await searchParams;
  const rows = await searchWorkspaceLibrary(
    {
      role: (session.user.role ?? "USER") as UserRole,
      email: session.user.email,
    },
    input,
  );
  return (
    <div className="os-page">
      <div className="os-page-head">
        <div>
          <h1>資料・事例を探す</h1>
          <p className="os-description">
            業種・商品・用途の言葉で、資料・商品・営業事例・実績・録画・Wikiをまとめて検索。
          </p>
        </div>
        <AiWorkButton
          context={{ task: `「${input.q ?? "提案"}」に使う資料を探す` }}
        />
      </div>
      <form className="os-library-filters" action="/dashboard/library">
        <label className="os-field">
          キーワード
          <input
            name="q"
            defaultValue={input.q}
            placeholder="例：歯科、TVer、提案、ブランド"
          />
        </label>
        <label className="os-field">
          種類
          <select name="kind" defaultValue={input.kind ?? "all"}>
            <option value="all">すべて</option>
            <option value="material">資料</option>
            <option value="package">商品・媒体</option>
            <option value="wiki">手順・Wiki</option>
            <option value="case">営業事例</option>
            <option value="portfolio">実績・素材</option>
            <option value="seminar">セミナー録画</option>
          </select>
        </label>
        <label className="os-field">
          更新日から
          <input type="date" name="from" defaultValue={input.from} />
        </label>
        <label className="os-field">
          更新日まで
          <input type="date" name="to" defaultValue={input.to} />
        </label>
        <label className="os-field">
          並び順
          <select name="sort" defaultValue={input.sort ?? "newest"}>
            <option value="newest">更新が新しい順</option>
            <option value="oldest">更新が古い順</option>
            <option value="name">名前順</option>
          </select>
        </label>
        <button type="submit" className="os-button-secondary">
          検索
        </button>
      </form>
      <p className="os-footnote">
        各種類の上位20件を表示。営業事例は投稿日、それ以外は更新日で絞ります。他社・媒体資料の価格は卸値の場合があります。販売料金はOSの商品・プランで確認してください。
      </p>
      <div className="os-library-results">
        {rows.length ? (
          rows.map((row) => (
            <Link
              key={`${row.kind}:${row.id}`}
              href={row.href}
              className="os-library-result"
            >
              <span>
                {row.source} · 更新{" "}
                {new Intl.DateTimeFormat("ja-JP", {
                  timeZone: "Asia/Tokyo",
                }).format(new Date(row.updatedAt))}
              </span>
              <h3>{row.title}</h3>
              <p>{row.excerpt}</p>
            </Link>
          ))
        ) : (
          <p className="os-empty">
            該当する資料がありません。別の言葉や種類で検索してください。
          </p>
        )}
      </div>
      <div className="os-home-links">
        {session.user.role !== "USER" && (
          <Link href="/dashboard/outreach-messages">送った営業文と結果 →</Link>
        )}
        <Link href="/dashboard/sales-approaches">アプローチ事例 →</Link>
        <Link href="/dashboard/portfolio">制作実績 →</Link>
        <Link href="/dashboard/seminars">録画 →</Link>
      </div>
    </div>
  );
}
