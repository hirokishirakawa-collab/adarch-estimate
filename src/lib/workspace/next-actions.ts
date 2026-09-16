export interface ActionCandidate {
  dealId?: string;
  leadId?: string;
  subsidyId?: string;
  name?: string;
  customer?: string;
  title?: string;
  expectedCloseDate?: string | null;
  preparedAt?: string | null;
  sentAt?: string | null;
  closedAt?: string | null;
}
export interface ActionSection {
  no: number;
  title: string;
  items: readonly ActionCandidate[];
}
export interface WorkAction {
  key: string;
  title: string;
  detail: string;
  href: string;
  date: string | null;
  order: number;
}
export function workActions(
  sections: readonly ActionSection[],
  limit = 3,
): WorkAction[] {
  const seen = new Set<string>();
  return sections
    .flatMap((section) =>
      section.items.map((item) => {
        const key = item.dealId
          ? `deal:${item.dealId}`
          : item.leadId
            ? `lead:${item.leadId}`
            : `subsidy:${item.subsidyId}`;
        const href = item.dealId
          ? `/dashboard/deals/${encodeURIComponent(item.dealId)}`
          : item.leadId
            ? `/dashboard/leads/list?q=${encodeURIComponent(item.name ?? "")}`
            : "/dashboard/subsidy-finder";
        return {
          key,
          title: section.title,
          detail: [item.customer ?? item.name, item.title]
            .filter(Boolean)
            .join(" · "),
          href,
          date:
            item.expectedCloseDate ??
            item.preparedAt ??
            item.sentAt ??
            item.closedAt ??
            null,
          order: section.no,
        };
      }),
    )
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .slice(0, limit);
}
