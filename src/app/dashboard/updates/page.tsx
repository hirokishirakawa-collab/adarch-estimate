import Link from "next/link";
import history from "@/lib/workspace/update-history.json";

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}) {
  const { q = "", from = "", to = "", sort = "newest" } = await searchParams;
  const rows = history
    .filter(
      (row) =>
        (!q || `${row.title} ${row.desc}`.includes(q)) &&
        (!from || row.date.replaceAll(".", "-") >= from) &&
        (!to || row.date.replaceAll(".", "-") <= to),
    )
    .sort((a, b) =>
      sort === "oldest"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date),
    );
  return (
    <div className="os-page">
      <div className="os-page-head">
        <div>
          <h1>更新履歴</h1>
          <p className="os-description">
            過去のお知らせです。現在の操作手順は
            <Link href="/dashboard/guide" className="underline">
              使い方ガイド
            </Link>
            をご覧ください。
          </p>
        </div>
      </div>
      <form className="os-library-filters">
        <label>
          キーワード
          <input name="q" defaultValue={q} />
        </label>
        <label>
          掲載日から
          <input type="date" name="from" defaultValue={from} />
        </label>
        <label>
          掲載日まで
          <input type="date" name="to" defaultValue={to} />
        </label>
        <label>
          並び順
          <select name="sort" defaultValue={sort}>
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
          </select>
        </label>
        <button className="os-button-secondary">絞り込む</button>
      </form>
      <div className="os-guide">
        {rows.map((row, i) => (
          <article key={`${row.date}-${i}`}>
            <p className="os-eyebrow">
              <time>{row.date}</time> · {row.tag}
            </p>
            <h2>{row.title}</h2>
            <p>{row.desc}</p>
          </article>
        ))}
        {!rows.length && (
          <p className="os-empty">条件に合う更新はありません。</p>
        )}
      </div>
    </div>
  );
}
