export function wikiGuidance(title: string, body: string) {
  if (
    /自動営業モニター/.test(title) ||
    /\/api\/auto-sales\/(?:check-responses|send|run)/.test(body)
  )
    return {
      notice:
        "旧仕様の記録です。自動営業は廃止されています。現在はAIで文面を準備し、人が送信した後に送付を確定します。",
      href: "/dashboard/guide",
    };
  if (
    /受注の確定はOS画面|受注ならOS画面|下書き.{0,40}時点で.{0,30}送付記録/.test(
      body,
    )
  )
    return {
      notice:
        "この記事には旧手順が含まれます。営業準備と実送付は別の状態です。受注はAIからも記録でき、案件が自動作成されます。営業メールの準備では、料金は本文に書かずOSの申込・プランページへ案内します。",
      href: "/dashboard/guide",
    };
  return null;
}
export function guidedWikiBody(title: string, body: string) {
  const guide = wikiGuidance(title, body);
  return guide
    ? `【現行手順の注記】${guide.notice}\n現行ガイド: ${guide.href}\n以下は過去の記事です。現行の実行手順として扱わないでください。\n\n${body}`
    : body;
}
