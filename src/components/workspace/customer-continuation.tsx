import Link from "next/link";
import { AiWorkButton } from "./ai-work-button";
import { DEAL_STATUS_OPTIONS } from "@/lib/constants/deals";
import { ConnectionPath } from "./work-connection";

type Deal = {
  id: string;
  title: string;
  status: string;
  expectedCloseDate: Date | null;
};
export function CustomerContinuation({
  customerId,
  customerName,
  deals,
  projectCount,
  lastActivityAt,
}: {
  customerId: string;
  customerName: string;
  deals: Deal[];
  projectCount: number;
  lastActivityAt: Date | null;
}) {
  const active = deals.filter(
    (deal) => !["CLOSED_WON", "CLOSED_LOST"].includes(deal.status),
  );
  return (
    <section className="os-next-step" aria-label="この顧客の続きを進める">
      <div className="os-next-step-top">
        <div>
          <p className="os-eyebrow">CONNECTED CONTEXT</p>
          <h2>このお客様の続きを。</h2>
          <p className="os-description">
            {lastActivityAt
              ? `最終活動 ${lastActivityAt.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}`
              : "活動はまだ記録されていません"}{" "}
            · 進行中の商談 {active.length}件 · 案件 {projectCount}件
          </p>
        </div>
        <AiWorkButton
          context={{
            customerId,
            customerName,
            label: customerName,
            path: `/dashboard/customers/${customerId}`,
          }}
        />
      </div>
      <ConnectionPath steps={["顧客", "商談", "案件・見積"]} />
      {active.slice(0, 3).map((deal) => (
        <div key={deal.id} className="os-action-row">
          <div className="os-action-copy">
            <h3>{deal.title}</h3>
            <p>
              {DEAL_STATUS_OPTIONS.find(
                (option) => option.value === deal.status,
              )?.label ?? deal.status}
              {deal.expectedCloseDate &&
                ` · 見込み ${deal.expectedCloseDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}`}
            </p>
          </div>
          <Link href={`/dashboard/deals/${deal.id}`}>商談の続き →</Link>
        </div>
      ))}
      <div className="os-next-step-actions">
        <Link className="os-button-secondary" href="#record-activity">
          やり取りを記録
        </Link>
        <Link className="os-button-secondary" href="#customer-deals">
          商談を確認
        </Link>
        <Link className="os-button-secondary" href="#customer-projects">
          案件・見積を確認
        </Link>
        <Link
          className="os-button-secondary"
          href={`/dashboard/estimates/new?customerId=${customerId}`}
        >
          見積を作る
        </Link>
      </div>
      <p className="os-footnote">
        受注時は案件が自動作成されます。案件・見積を確認してから、続きの作業を進めてください。
      </p>
    </section>
  );
}
