export interface AiWorkContext {
  task?: string;
  label: string;
  path: string;
  customerId?: string;
  customerName?: string;
  dealId?: string;
  leadId?: string;
}

export function buildAiWorkPrompt(context: AiWorkContext) {
  // Copy only the selected work's identifiers, never browser DOM, tokens or query strings.
  const path = context.path.split(/[?#]/)[0];
  const safePath =
    /^\/dashboard(?:\/|$)/.test(path) && !path.includes("..")
      ? path
      : "/dashboard";
  const customerId =
    context.customerId ??
    safePath.match(/^\/dashboard\/customers\/([^/]+)$/)?.[1];
  const dealId =
    context.dealId ?? safePath.match(/^\/dashboard\/deals\/([^/]+)$/)?.[1];
  return [
    `Ad Arch OSで「${context.task || context.label + "の続きを進める"}」をお願いします。`,
    `対象の作業：${context.label}`,
    context.customerName ? `対象の顧客：${context.customerName}` : null,
    customerId && customerId !== "new" ? `customerId: ${customerId}` : null,
    dealId && dealId !== "new" ? `dealId: ${dealId}` : null,
    context.leadId ? `leadId: ${context.leadId}` : null,
    `OSの画面：${safePath}`,
    "接続しているOSから対象と最新の履歴を確認してください。同じ顧客・商談を重複して作らず、既存の続きとして進めてください。",
    "終わったら、準備・記録したこと、まだ私が行うこと、OSで続きを開くリンクを短く返してください。営業の送信は私が行います。準備しただけで送付済みにしないでください。",
  ]
    .filter(Boolean)
    .join("\n");
}
