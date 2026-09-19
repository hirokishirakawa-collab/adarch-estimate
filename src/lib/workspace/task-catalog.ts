import type { NavigationItem } from "@/lib/navigation/catalog";

const SALES_TASKS: HubTask[] = [
  { id: "find", scene: "orbit", number: "01", english: "DISCOVER", title: "営業先を探す", caption: "これから声をかける相手を見つける", hint: "相手の探し方を選ぶ", next: "相手が決まったら「提案・連絡を準備する」へ。" },
  { id: "prepare", scene: "sheets", titleLines: ["提案・連絡を", "準備する"], number: "02", english: "CREATE", title: "提案・連絡を準備する", caption: "営業文・見積もり・送る材料を用意する", hint: "お客様へ渡すものを選ぶ", next: "連絡した後は「返事・営業結果を記録する」へ。" },
  { id: "reply", scene: "messages", titleLines: ["返事・営業結果を", "記録する"], number: "03", english: "CONNECT", title: "返事・営業結果を記録する", caption: "連絡した後の反応を残す", hint: "送った後の仕事を進める", next: "話が進んだら「顧客・商談を見る」へ。" },
  { id: "manage", scene: "network", number: "04", english: "CONTINUE", title: "顧客・商談を見る", caption: "これまでの会話と、提案の続きを確認する", hint: "相手の情報か、提案の進み具合か", next: "次の提案を用意するときは「提案・連絡を準備する」へ。" },
];

export type TaskGroup = "sales" | "projects" | "library" | "publishing" | "procedures";
export type HubScene = "orbit" | "sheets" | "messages" | "network";
export type HubTask = { id: string; number: string; english: string; title: string; caption: string; hint: string; next: string; scene: HubScene; titleLines?: readonly string[] };
export type HubTool = { task: string; title: string; description: string; item: NavigationItem };
type ToolDescription = Omit<HubTool, "item">;

/** Presentation only. Destinations are always intersected with the server's permitted items. */
const SALES_TOOL_DESCRIPTIONS: Record<string, ToolDescription> = {
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

const PROJECT_TASKS: HubTask[] = [
  { id: "progress", scene: "network", number: "01", english: "PROGRESS", title: "案件を進める", caption: "仕事を登録し、進み具合を確認する", hint: "進行中の仕事を開く", next: "配信や審査の手続きは「広告を申請する」へ。" },
  { id: "request", scene: "sheets", number: "02", english: "REQUEST", title: "広告を申請する", caption: "TVerの考査・配信、媒体の依頼を進める", hint: "必要な手続きを選ぶ", next: "TVerの申請状況は「案件を進める」から確認できます。" },
  { id: "operate", scene: "orbit", number: "03", english: "OPERATE", title: "配信・運用をする", caption: "サイネージを動かす", hint: "運用するサービスを選ぶ", next: "一緒に進める人が必要なら「協力者を探す」へ。" },
  { id: "team", scene: "messages", number: "04", english: "TEAM UP", title: "協力者を探す", caption: "メンバーやクリエイターとつながる", hint: "仕事に合う相手を探す", next: "決まった仕事は「案件を進める」から登録できます。" },
];
const LIBRARY_TASKS: HubTask[] = [
  { id: "materials", scene: "sheets", number: "01", english: "MATERIALS", title: "使う資料を探す", caption: "提案資料・ロゴ・制作素材を取り出す", hint: "ほしい材料の探し方を選ぶ", next: "媒体を選ぶところからなら「商品・媒体を選ぶ」へ。" },
  { id: "media", scene: "orbit", number: "02", english: "MEDIA", title: "商品・媒体を選ぶ", caption: "広告メニューとシミュレーターを見る", hint: "提案する媒体を選ぶ", next: "提案の参考になる実例は「実績・事例を見る」へ。" },
  { id: "examples", scene: "network", number: "03", english: "INSPIRATION", title: "実績・事例を見る", caption: "映像実績や営業アプローチを参考にする", hint: "見たい実績・事例を選ぶ", next: "実践の進め方を知りたいときは「使い方を学ぶ」へ。" },
  { id: "learn", scene: "messages", number: "04", english: "LEARNING", title: "使い方を学ぶ", caption: "AI・OS・営業の進め方を確認する", hint: "知りたいことから選ぶ", next: "すぐに使える材料は「使う資料を探す」にあります。" },
];
const PROJECT_TOOL_DESCRIPTIONS: Record<string, ToolDescription> = {
  "/dashboard/projects": { task: "progress", title: "進行中の案件を見る", description: "案件一覧から、仕事の進み具合を確認する。" },
  "/dashboard/projects/new": { task: "progress", title: "新しい案件を登録する", description: "これから進める仕事の情報を登録する。" },
  "/dashboard/regulars": { task: "progress", title: "レギュラー案件を見る", description: "継続している仕事を確認する。" },
  "/dashboard/tver": { task: "progress", title: "TVerの進行状況を見る", description: "考査・配信の申請と進行状況を確認する。" },
  "/dashboard/tver-reports": { task: "progress", title: "TVerの配信実績を見る", description: "配信した広告の実績を確認する。" },
  "/dashboard/tver-review": { task: "request", title: "TVerの業態考査を申請する", description: "広告主の業態について、掲載できるか審査を依頼する。" },
  "/dashboard/tver-creative-review": { task: "request", title: "TVerの素材考査を申請する", description: "使用するCM素材の審査を依頼する。" },
  "/dashboard/tver-campaign": { task: "request", title: "TVerの配信を申請する", description: "配信したい広告の内容を申請する。" },
  "/dashboard/media": { task: "request", title: "媒体の手配を依頼する", description: "広告媒体への依頼を進める。" },
  "/dashboard/signage": { task: "operate", title: "サイネージの端末を見る", description: "端末の登録情報と動作状況を確認する。" },
  "/dashboard/signage/playlists": { task: "operate", title: "サイネージの再生枠を組む", description: "プレイリストから、再生する内容を整える。" },
  "/dashboard/signage/assets": { task: "operate", title: "サイネージの素材を管理する", description: "端末で再生する素材を確認する。" },
  "/dashboard/project-matching": { task: "team", title: "案件マッチングを見る", description: "協力できる仕事や募集を確認する。" },
  "/dashboard/creators": { task: "team", title: "クリエイターを探す", description: "制作を相談するクリエイターを検索する。" },
};
const LIBRARY_TOOL_DESCRIPTIONS: Record<string, ToolDescription> = {
  "/dashboard/library": { task: "materials", title: "資料・事例をまとめて検索する", description: "複数の置き場を横断して、ほしい資料を探す。" },
  "/dashboard/knowledge": { task: "materials", title: "資料ライブラリを見る", description: "登録された資料から、提案に使う情報を探す。" },
  "/dashboard/brand-kit": { task: "materials", title: "ブランド・制作の材料を使う", description: "ロゴ・資料の型・AI用の材料を取り出す。" },
  "/dashboard/vault": { task: "materials", title: "制作素材をコピーする", description: "AdArch Vaultから、使う素材を探す。" },
  "/dashboard/tver-simulator": { task: "media", title: "TVer広告を試算する", description: "配信の提案に向けて、シミュレーターを開く。" },
  "/dashboard/packages": { task: "media", title: "提案するパッケージを見る", description: "商品パッケージの内容を確認する。" },
  "/dashboard/taxi-ads-simulator": { task: "media", title: "タクシー広告を検討する", description: "TOKYO PRIMEのシミュレーターを開く。" },
  "/dashboard/skylark-simulator": { task: "media", title: "すかいらーくの店内広告を検討する", description: "インストア広告のシミュレーターを開く。" },
  "/dashboard/univ-coop-simulator": { task: "media", title: "大学生協広告を検討する", description: "大学生協広告のシミュレーターを開く。" },
  "/dashboard/aeon-cinema-simulator": { task: "media", title: "映画館の広告を検討する", description: "イオンシネマのシミュレーターを開く。" },
  "/dashboard/golfcart-simulator": { task: "media", title: "ゴルフカート広告を検討する", description: "Golfcart Visionのシミュレーターを開く。" },
  "/dashboard/omochannel-simulator": { task: "media", title: "アパホテルの広告を検討する", description: "おもチャンネルのシミュレーターを開く。" },
  "/dashboard/portfolio": { task: "examples", title: "制作実績を検索する", description: "実績フォルダから、参考になる制作物を探す。" },
  "/dashboard/sales-approaches": { task: "examples", title: "営業アプローチの事例を見る", description: "声のかけ方や提案の切り口を参考にする。" },
  "https://drive.google.com/drive/folders/11CJPv-D_37Vn1zntRzI9Qqc2SV89fKPT?usp=drive_link": { task: "examples", title: "実績フォルダをDriveで開く", description: "共有フォルダから、実績の資料を確認する。" },
  "/dashboard/guide": { task: "learn", title: "AIとOSの使い方を見る", description: "操作やAIとの連携方法を確認する。" },
  "/dashboard/playbook": { task: "learn", title: "営業の進め方を確認する", description: "営業プレイブックから、実践の手順を探す。" },
  "/dashboard/wiki": { task: "learn", title: "社内Wikiで調べる", description: "社内で共有している知識を確認する。" },
  "/dashboard/learning": { task: "learn", title: "研修で学ぶ", description: "ラーニングの学習コンテンツを開く。" },
};

const PUBLISHING_TASKS: HubTask[] = [
  { id: "deliver", scene: "orbit", number: "01", english: "DELIVER", title: "Meta広告・チラシ・DM・LINEを届ける", caption: "お金をかけて、営業先に確実に届ける", hint: "届ける手段を選ぶ", next: "読んでもらう材料は「オウンドメディアに記事を書く」へ。" },
  { id: "write", scene: "sheets", number: "02", english: "WRITE", title: "オウンドメディアに記事を書く", caption: "仕事や地域の話を、Journalに載せる", hint: "書いた原稿は本部が確認してから公開", next: "話して伝えるなら「セミナーで伝える」へ。" },
  { id: "seminar", scene: "messages", number: "03", english: "SEMINAR", title: "セミナーで伝える", caption: "自社のセミナー録画を、窓口付きリンクで届ける", hint: "録画を登録・共有する", next: "話す人の紹介は「自分を紹介する」で整えられます。" },
  { id: "profile", scene: "network", number: "04", english: "PROFILE", title: "自分を紹介する", caption: "メンバー紹介で、人柄と仕事を伝える", hint: "紹介ページを確認する", next: "反応があったら「顧客・営業」で結果を残せます。" },
];
const PUBLISHING_TOOL_DESCRIPTIONS: Record<string, ToolDescription> = {
  "/dashboard/meta-ads": { task: "deliver", title: "Meta広告を自動運用する", description: "地域を絞ったMeta広告を、AIとMeta公式コネクタで作って記録する。" },
  "/dashboard/tver-flyer": { task: "deliver", title: "TVerの営業チラシを作る", description: "チラシ制作サポートで、営業に使う材料を用意する。" },
  "/dashboard/leads/dm": { task: "deliver", title: "郵送DMを準備する", description: "チラシと送付先を用意する。" },
  "/dashboard/line": { task: "deliver", title: "LINE公式アカウントで届ける", description: "LINE公式アカウントの管理画面を開く。" },
  "/dashboard/journal": { task: "write", title: "Journalに記事を書く", description: "タイトル・写真・本文を入れて、本部に確認を依頼する。" },
  "/dashboard/seminars": { task: "seminar", title: "セミナーの録画を登録・共有する", description: "自社の窓口付きリンクで、録画をお客様に送る。" },
  "/dashboard/group-profiles": { task: "profile", title: "メンバー紹介を見る", description: "自分と仲間の紹介から、人柄と仕事を伝える。" },
};

const PROCEDURE_TASKS: HubTask[] = [
  { id: "client-billing", scene: "sheets", number: "01", english: "CLIENTS", title: "お客様への請求", caption: "本部 → 各社クライアント", hint: "本部に請求を依頼する", next: "請求に使う自社情報は「各社から本部へ」で登録できます。" },
  { id: "to-hq", scene: "network", number: "02", english: "TO HQ", title: "各社から本部へ", caption: "月次報告・経理情報の登録", hint: "各社 → 本部", next: "本部からの支払明細・ステータスは「本部から各社へ」で確認できます。" },
  { id: "from-hq", scene: "orbit", number: "03", english: "FROM HQ", title: "本部から各社へ", caption: "稼働ステータス・支払明細など", hint: "本部 → グループ各社", next: "本部へ確認したいことは「相談・共有する」へ。" },
  { id: "hq-support", scene: "messages", number: "04", english: "SUPPORT", title: "相談・共有する", caption: "打ち合わせの予約・相談・共有", hint: "本部への相談・共有", next: "提出・報告の入口は「各社から本部へ」にあります。" },
];
const PROCEDURE_TOOL_DESCRIPTIONS: Record<string, ToolDescription> = {
  "/dashboard/billing": { task: "client-billing", title: "お客様への請求を依頼する", description: "本部から各社クライアントへの請求を依頼する。" },
  "/dashboard/partner-status": { task: "from-hq", title: "稼働ステータスを申告する", description: "自社の現在の稼働状況を申告する。" },
  "/dashboard/payments": { task: "from-hq", title: "支払明細を確認する", description: "本部からの支払明細を確認する。" },
  "/dashboard/royalty": { task: "from-hq", title: "ロイヤリティを確認する", description: "自社のロイヤリティの情報を確認する。" },
  "/dashboard/sales-report": { task: "to-hq", title: "月次報告を提出する", description: "月次報告の画面を開き、報告・確認を進める。" },
  "/dashboard/billing/settings": { task: "to-hq", title: "経理情報を登録する", description: "請求に使う自社の情報を登録・確認する。" },
  "/dashboard/procedures": { task: "to-hq", title: "自社の提出・連絡を確認する", description: "自社で行う提出や、本部への連絡の入口をまとめて見る。" },
  "https://calendar.app.google/pfFBZxmHbNFFp6cs5": { task: "hq-support", title: "本部との打ち合わせを予約する", description: "予約ページを開き、打ち合わせの日時を選ぶ。" },
  "/dashboard/violation-report": { task: "hq-support", title: "コンプライアンスを相談する", description: "本部へのコンプライアンス相談窓口を開く。" },
  "https://drive.google.com/drive/folders/1p9QtqSbPrBAkof5-10jeusyG6T2y7cB8?usp=drive_link": { task: "hq-support", title: "グループ運用データを見る", description: "Driveの共有フォルダを開く。" },
};

export const TASK_HUBS = {
  sales: { label: "顧客・営業", english: "YOUR NEXT MOVE", invitation: "次の仕事を、ここから。", tasks: SALES_TASKS, tools: SALES_TOOL_DESCRIPTIONS },
  projects: { label: "案件・申請", english: "MAKE IT HAPPEN", invitation: "仕事を、ひとつ先へ。", tasks: PROJECT_TASKS, tools: PROJECT_TOOL_DESCRIPTIONS },
  procedures: { label: "手続き", english: "KEEP THINGS MOVING", invitation: "必要な手続きを、迷わず。", tasks: PROCEDURE_TASKS, tools: PROCEDURE_TOOL_DESCRIPTIONS },
  library: { label: "資料・事例", english: "IDEAS INTO ACTION", invitation: "次の提案に、いい材料を。", tasks: LIBRARY_TASKS, tools: LIBRARY_TOOL_DESCRIPTIONS },
  publishing: { label: "発信", english: "TELL YOUR STORY", invitation: "地域と人のことを、外に届ける。", tasks: PUBLISHING_TASKS, tools: PUBLISHING_TOOL_DESCRIPTIONS },
} satisfies Record<TaskGroup, { label: string; english: string; invitation: string; tasks: HubTask[]; tools: Record<string, ToolDescription> }>;

/** Only destinations granted by the server may become cards, links or search results. */
export function toolsForItems(group: TaskGroup, items: readonly NavigationItem[]): HubTool[] {
  const definition = TASK_HUBS[group];
  const permitted = new Map(items.filter((item) => item.group === group && item.href !== `/dashboard/work/${group}`).map((item) => [item.href, item]));
  const tools: HubTool[] = [];
  for (const [href, description] of Object.entries(definition.tools)) {
    const item = permitted.get(href);
    if (item) {
      tools.push({ ...description, item });
      permitted.delete(href);
    }
  }
  // Keep future authorized entries reachable even before their presentation is customized.
  for (const item of permitted.values()) {
    tools.push({ item, task: definition.tasks[0].id, title: item.label, description: `${item.section}の機能を開く。` });
  }
  return tools;
}

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja");
export function searchTools(tools: readonly HubTool[], query: string): HubTool[] {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return tools.filter((tool) => {
    const text = normalize([tool.title, tool.description, tool.item.label, tool.item.section, ...tool.item.aliases].join(" "));
    return words.every((word) => text.includes(word));
  });
}
