import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadViewer } from "@/lib/mcp/os-read-tools";
import { tverOverview, TVER_STATUS } from "@/lib/workspace/tver-overview";
import { AiWorkButton } from "@/components/workspace/ai-work-button";

export default async function TverOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  const viewer = session?.user?.email
    ? await loadViewer(session.user.email)
    : null;
  if (!viewer) redirect("/login");
  const input = await searchParams;
  const { advertisers, count, page, pages } = await tverOverview(viewer, input);
  const pageLink = (value: number) => {
    const params = new URLSearchParams();
    for (const [key, item] of Object.entries(input))
      if (item) params.set(key, item);
    params.set("page", String(value));
    return `/dashboard/tver?${params}`;
  };
  const date = (value: Date) =>
    value.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  return (
    <div className="os-page">
      <div className="os-page-head">
        <div>
          <h1>TVerを進める</h1>
          <p className="os-description">
            広告主ごとに、業態考査・素材考査・配信申請の続きを確認。
          </p>
        </div>
        <Link className="os-button-primary" href="/dashboard/tver-review/new">
          広告主の考査を申請
        </Link>
      </div>
      <div className="os-start-links">
        <Link href="/dashboard/tver-reports">公開済み配信レポート →</Link>
        <Link href="/dashboard/tver-order-link">お客様向け申込リンク →</Link>
        <Link href="/dashboard/tver-simulator">配信を試算 →</Link>
      </div>
      <form className="os-library-filters">
        <label>
          広告主名
          <input name="q" defaultValue={input.q} maxLength={120} />
        </label>
        <label>
          業態更新日から
          <input name="from" type="date" defaultValue={input.from} />
        </label>
        <label>
          業態更新日まで
          <input name="to" type="date" defaultValue={input.to} />
        </label>
        <label>
          並び順
          <select name="sort" defaultValue={input.sort ?? "newest"}>
            <option value="newest">業態更新が新しい順</option>
            <option value="oldest">業態更新が古い順</option>
            <option value="name">名前順</option>
          </select>
        </label>
        <button className="os-button-secondary">絞り込む</button>
      </form>
      <p className="os-footnote">
        {count}広告主 · {page}/{pages}
        ページ。広告主の考査承認後に、素材考査・配信申請へ進めます。
      </p>
      {advertisers.map((ad) => (
        <section key={ad.id} className="os-tver-advertiser">
          <div className="os-section-head">
            <div>
              <h2>{ad.name}</h2>
              <p className="os-description">
                {ad.branch.name} · 業態更新 {date(ad.updatedAt)}
              </p>
            </div>
            <AiWorkButton
              secondary
              context={{
                label: ad.name,
                task: "この広告主のTVer申請の続きを確認する",
                path: `/dashboard/tver-review/${ad.id}`,
              }}
            />
          </div>
          <div className="os-tver-stages">
            <div>
              <h3>01 業態考査</h3>
              <Link
                href={`/dashboard/tver-review/${ad.id}`}
                className="os-tver-item"
              >
                <span
                  className={`os-status ${ad.status === "APPROVED" ? "os-status-success" : ""}`}
                >
                  {TVER_STATUS[ad.status]}
                </span>
                <span>申請を確認 →</span>
              </Link>
            </div>
            <div>
              <h3>02 素材考査</h3>
              {ad.tverCreativeReviews.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/tver-creative-review/${r.id}`}
                  className="os-tver-item"
                >
                  <span>{r.projectName}</span>
                  <span
                    className={`os-status ${r.status === "APPROVED" ? "os-status-success" : ""}`}
                  >
                    {TVER_STATUS[r.status]}
                  </span>
                </Link>
              ))}
              {!ad.tverCreativeReviews.length && (
                <p className="os-description">申請はありません</p>
              )}
              {ad._count.tverCreativeReviews > 5 && (
                <Link href="/dashboard/tver-creative-review">
                  ほかの申請も確認 →
                </Link>
              )}
              {ad.status === "APPROVED" && (
                <Link
                  className="os-tver-new"
                  href={`/dashboard/tver-creative-review/new?advertiserId=${ad.id}`}
                >
                  この広告主の素材を申請 →
                </Link>
              )}
            </div>
            <div>
              <h3>03 配信申請</h3>
              {ad.tverCampaigns.map((r) => (
                <Link
                  key={r.id}
                  href={`/dashboard/tver-campaign/${r.id}`}
                  className="os-tver-item"
                >
                  <span>
                    {r.campaignName}
                    <small>
                      {date(r.startDate)}〜{date(r.endDate)}
                    </small>
                  </span>
                  <span
                    className={`os-status ${r.status === "APPROVED" ? "os-status-success" : ""}`}
                  >
                    {TVER_STATUS[r.status]}
                  </span>
                </Link>
              ))}
              {!ad.tverCampaigns.length && (
                <p className="os-description">申請はありません</p>
              )}
              {ad._count.tverCampaigns > 5 && (
                <Link href="/dashboard/tver-campaign">ほかの申請も確認 →</Link>
              )}
              {ad.status === "APPROVED" && (
                <Link
                  className="os-tver-new"
                  href={`/dashboard/tver-campaign/new?advertiserId=${ad.id}`}
                >
                  この広告主の配信を申請 →
                </Link>
              )}
            </div>
          </div>
        </section>
      ))}
      {!advertisers.length && (
        <p className="os-empty">該当する広告主はいません。</p>
      )}
      <nav className="os-home-links" aria-label="ページ切り替え">
        {page > 1 && <Link href={pageLink(page - 1)}>← 前の20件</Link>}
        {page < pages && <Link href={pageLink(page + 1)}>次の20件 →</Link>}
      </nav>
      <p className="os-footnote">
        素材・配信はそれぞれ更新が新しい5件を表示します。配信レポートとお客様からの直接申込は別の記録のため、上部のリンクから確認できます。
      </p>
    </div>
  );
}
