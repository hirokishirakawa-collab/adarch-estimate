import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";
import type { NavigationGroup } from "@/lib/navigation/catalog";
import type { AiWorkContext } from "@/lib/navigation/ai-context";
import { AiWorkButton } from "./ai-work-button";

const paths: Partial<Record<NavigationGroup, string[]>> = {
  sales: ["顧客", "商談", "提案"],
  projects: ["案件", "制作", "納品"],
  library: ["資料", "事例", "提案"],
  procedures: ["自分の記録", "本部", "確認"],
};

/** Describes the work context, never a fabricated processing or completion state. */
export function ConnectionPath({ steps }: { steps: string[] }) {
  return (
    <ol className="os-connection-path" aria-label="仕事のつながり">
      {steps.map((step) => <li key={step}><span>{step}</span></li>)}
    </ol>
  );
}

export function WorkConnection({ group }: { group: NavigationGroup }) {
  return (
    <aside className="os-work-connection" aria-label="この仕事とAIの連携">
      <p className="os-connection-kicker"><Link2 size={14} aria-hidden /> CONNECTED CONTEXT</p>
      <h2>この仕事から、AIへ。</h2>
      <ConnectionPath steps={paths[group] ?? ["仕事", "情報", "AI"]} />
      <AiWorkButton secondary label="依頼を用意する" />
    </aside>
  );
}

export function RecordConnection({
  customer, label, path, dealId,
}: {
  customer?: { id: string; name: string } | null;
  label: string;
  path: string;
  dealId?: string;
}) {
  const context: Partial<AiWorkContext> = {
    label, path, dealId, customerId: customer?.id, customerName: customer?.name,
  };
  return (
    <section className="os-record-connection" aria-label="この仕事をAIに引き継ぐ">
      <div className="os-record-context">
        <Link2 size={17} aria-hidden />
        {customer && <><Link href={`/dashboard/customers/${customer.id}`}>{customer.name}</Link><ArrowRight size={14} aria-hidden /></>}
        <span>{label}</span>
      </div>
      <AiWorkButton context={context} secondary label="この仕事をAIへ" />
    </section>
  );
}

export function HomeHeading() {
  return (
    <header className="os-page-head os-home-heading">
      <div>
        <p className="os-eyebrow">OUR NETWORK, YOUR NEXT MOVE</p>
        <h1><span>みんなの動きを、</span><wbr /><span>次の一手に。</span></h1>
        <p className="os-description">人とAIがつながる、アドアーチのワークスペース。</p>
      </div>
      <Link className="os-button-secondary" href="/dashboard/ai">AIでできる仕事 <ArrowRight size={16} aria-hidden /></Link>
    </header>
  );
}
