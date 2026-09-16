import Link from "next/link";
import { auth } from "@/lib/auth";
import { loadViewer, myNextActions } from "@/lib/mcp/os-read-tools";
import { workActions } from "@/lib/workspace/next-actions";
import { AiWorkButton } from "./ai-work-button";

export async function NextActions({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.email || session.user.isActive === false) return null;
  let rows: ReturnType<typeof workActions>;
  try {
    const viewer = await loadViewer(session.user.email);
    if (!viewer) throw new Error("利用者の情報を確認できませんでした");
    const result = await myNextActions(viewer, { limit: expanded ? 10 : 3 });
    rows = workActions(result.sections, expanded ? 90 : 3);
  } catch (error) {
    console.error(
      "[workspace next actions]",
      error instanceof Error ? error.message : error,
    );
    return (
      <p className="os-notice" role="status">
        今日の一手を取得できませんでした。
        <Link href="/dashboard/work/sales">顧客・営業を開く →</Link>
      </p>
    );
  }
  return (
    <section data-tour="next-actions" aria-label="今日の一手">
      <div className="os-section-head">
        <h2>今日の一手</h2>
        {!expanded && (
          <Link href="/dashboard/next-actions">候補をすべて見る →</Link>
        )}
      </div>
      {rows.length ? (
        rows.map((row, i) => (
          <div key={row.key} className="os-action-row">
            <span className="os-action-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="os-action-copy">
              <h3>{row.title}</h3>
              <p>{row.detail}</p>
              {expanded && row.date && (
                <time className="os-footnote">関連日 {row.date}</time>
              )}
            </div>
            <Link href={row.href}>確認 →</Link>
            {expanded && (
              <AiWorkButton
                secondary
                label="AIで続ける"
                context={{
                  task: row.title,
                  label: row.detail,
                  path: row.href,
                  leadId: row.key.startsWith("lead:")
                    ? row.key.slice(5)
                    : undefined,
                }}
              />
            )}
          </div>
        ))
      ) : (
        <p className="os-empty">
          いま優先して確認する項目はありません。
          <Link href="/dashboard/work/sales">営業を進める →</Link>
        </p>
      )}
      {expanded && (
        <p className="os-footnote">
          AIの「今日何する」と同じ候補です。各分類は最大10件、同じ相手・商談は重複表示しません。
        </p>
      )}
    </section>
  );
}
