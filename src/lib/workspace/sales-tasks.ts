import type { NavigationItem } from "@/lib/navigation/catalog";

export const SALES_TASKS = [
  { id: "find", number: "01", english: "DISCOVER", title: "営業先を探す", caption: "これから声をかける相手を見つける", hint: "相手の探し方を選ぶ", next: "相手が決まったら「提案・連絡を準備する」へ。" },
  { id: "prepare", number: "02", english: "CREATE", title: "提案・連絡を準備する", caption: "営業文・見積もり・送る材料を用意する", hint: "お客様へ渡すものを選ぶ", next: "連絡した後は「返事・営業結果を記録する」へ。" },
  { id: "reply", number: "03", english: "CONNECT", title: "返事・営業結果を記録する", caption: "連絡した後の反応を残す", hint: "送った後の仕事を進める", next: "話が進んだら「顧客・商談を見る」へ。" },
  { id: "manage", number: "04", english: "CONTINUE", title: "顧客・商談を見る", caption: "これまでの会話と、提案の続きを確認する", hint: "相手の情報か、提案の進み具合か", next: "次の提案を用意するときは「提案・連絡を準備する」へ。" },
] as const;

export type SalesTaskId = (typeof SALES_TASKS)[number]["id"];
type ToolDescription = { task: SalesTaskId; title: string; description: string };
export type SalesTool = ToolDescription & { item: NavigationItem };

/** Presentation only. Destinations are always intersected with the server's permitted items. */
export const SALES_TOOL_DESCRIPTIONS: Record<string, ToolDescription> = {
  "/dashboard/leads": { task: "find", title: "新しい営業先を探す", description: "地域・業種から、声をかける会社を探す。" },
  "/dashboard/leads/list": { task: "find", title: "保存した見込み先を見る", description: "すでに見つけた候補から、営業する相手を選ぶ。" },
  "/dashboard/ad-buyer-finder": { task: "find", title: "広告を出している店を探す", description: "広告出稿者ファインダーで、掲載中の地元店を探す。" },
  "/dashboard/anniversary-finder": { task: "find", title: "周年を迎える会社を探す", description: "周年ファインダーで、記念広告の提案先を探す。" },
  "/dashboard/tender-finder": { task: "find", title: "自治体の案件を探す", description: "入札ファインダーで、広告・映像などの案件を確認する。" },
  "/dashboard/leads/tvcm-pool": { task: "find", title: "本部からの候補先を見る", description: "本部が集めた候補企業を確認する。" },
  "/dashboard/franchise-leads": { task: "find", title: "加盟候補を探す", description: "加盟リード獲得AIで、グループへの加盟候補を探す。" },
  "/dashboard/outreach-pipeline": { task: "prepare", title: "営業文を準備する", description: "アウトリーチで、相手に送る文面を用意する。" },
  "/dashboard/estimates": { task: "prepare", title: "見積もりを作る", description: "公式見積もりで、提案する内容をまとめる。" },
  "/dashboard/strategy-advisor": { task: "prepare", title: "提案の切り口をAIに相談する", description: "提案戦略アドバイザーで、相手に合う提案を考える。" },
  "/dashboard/tver-order-link": { task: "prepare", title: "TVerの相談リンクを用意する", description: "お客様に渡すTVer相談リンクを確認する。" },
  "/dashboard/leads/dm": { task: "prepare", title: "郵送DMを準備する", description: "チラシと送付先を用意する。" },
  "/dashboard/subsidy-finder": { task: "prepare", title: "使える補助金を探す", description: "広告費・制作費の財源になる制度を探す。" },
  "/dashboard/award-finder": { task: "prepare", title: "応募できる広告賞を探す", description: "クライアントとの会話に使う、広告賞の情報を探す。" },
  "/dashboard/video-achievements": { task: "prepare", title: "他社の制作実績を探す", description: "提案の参考にする、他社の映像実績を調べる。" },
  "/dashboard/leads/awaiting": { task: "reply", title: "返事・営業結果を記録する", description: "連絡した相手の反応を残し、次の対応を確認する。" },
  "/dashboard/auto-sales/history": { task: "reply", title: "送付した企業・履歴を見る", description: "どの相手に連絡したかを確認する。" },
  "/dashboard/outreach-messages": { task: "reply", title: "送った営業文を見返す", description: "使った文面と、その結果を確認する。" },
  "/dashboard/activity": { task: "reply", title: "営業活動を振り返る", description: "これまでの活動記録を確認する。" },
  "/dashboard/sales-insights": { task: "reply", title: "営業分析レポートを見る", description: "営業の結果を分析して、次の動きに活かす。" },
  "/dashboard/customers": { task: "manage", title: "顧客とやり取りを見る", description: "会社の情報と、これまでの会話を確認する。" },
  "/dashboard/deals": { task: "manage", title: "進行中の商談を見る", description: "提案ごとの進み具合と、次の対応を確認する。" },
  "/dashboard/meetings": { task: "manage", title: "会議メモを見る", description: "面談・打ち合わせの記録を確認する。" },
  "/dashboard/business-cards": { task: "manage", title: "名刺を整理する", description: "名刺管理で、相手の連絡先を確認する。" },
  "/dashboard/clients": { task: "manage", title: "取引先を地図で見る", description: "取引先マップで、地域ごとの相手を確認する。" },
  "/dashboard/sales": { task: "manage", title: "営業フローを見る", description: "営業の進み方を確認する。" },
};

export function salesToolsForItems(items: readonly NavigationItem[]): SalesTool[] {
  const permitted = new Map(items.filter((item) => item.group === "sales" && item.href !== "/dashboard/work/sales").map((item) => [item.href, item]));
  const tools: SalesTool[] = [];
  for (const [href, description] of Object.entries(SALES_TOOL_DESCRIPTIONS)) {
    const item = permitted.get(href);
    if (item) {
      tools.push({ ...description, item });
      permitted.delete(href);
    }
  }
  // Future catalog entries stay discoverable without broadening their permissions.
  for (const item of permitted.values()) {
    tools.push({ item, task: "manage", title: item.label, description: `${item.section}の機能を開く。` });
  }
  return tools;
}

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja");
export function searchSalesTools(tools: readonly SalesTool[], query: string): SalesTool[] {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return tools.filter((tool) => {
    const text = normalize([tool.title, tool.description, tool.item.label, tool.item.section, ...tool.item.aliases].join(" "));
    return words.every((word) => text.includes(word));
  });
}
