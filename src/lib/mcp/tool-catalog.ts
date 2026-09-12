// ==============================================================
// OSツール台帳 — MCP（各代表の Claude / ChatGPT）と OS内のアーチくんが同じ定義を使う
//   ここに1回書けば、両方の入口に同じ名前・同じ説明・同じ実装で出る。
//   kind: "read"  = scope os:read  / アーチくんは誰でも
//         "write" = scope os:write / アーチくんは誰でも（本人の権限で書く）
//   uiTemplate: ChatGPT Apps SDK のウィジェット資源（ui://…）。Claude 側は無視するので害はない
// ==============================================================

import { z } from "zod";
import * as os from "./os-read-tools";
import * as osw from "./os-write-tools";
import * as ins from "./os-insight-tools";
import * as camp from "./os-campaign-tools";
import * as wk from "./os-weekly-tools";
import * as tv from "./os-tver-tools";
import { createLocalCampaign } from "@/lib/meta-ads/local-campaign";
import { resolveMetaConfig } from "@/lib/meta-ads/account";
import { appUrl } from "@/lib/tver-order/service";
import { discoverLeads } from "@/lib/leads/discover";
import { prepareDm } from "@/lib/dm/prepare-dm";
import { listAdBuyers } from "@/lib/ad-buyers/list";
import { AD_PLATFORMS } from "@/lib/ad-buyers/platforms";

export type ToolKind = "read" | "write";

export interface OsToolDef<A extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  kind: ToolKind;
  input: A;
  run: (viewer: os.McpViewer, args: z.infer<A>) => Promise<unknown> | unknown;
  /** ChatGPT Apps SDK: 結果を描くウィジェットの資源URI */
  uiTemplate?: string;
  /** 書き込み前の確認文（Elicitation対応クライアントにだけ出す）。args から作る */
  confirm?: (args: z.infer<A>) => string;
}

const def = <A extends z.ZodObject>(d: OsToolDef<A>): OsToolDef => d as unknown as OsToolDef;

export const UI_DEAL_CARD = "ui://adarch-os/deal-card.html";
export const UI_NEXT_ACTIONS = "ui://adarch-os/next-actions.html";

// ---------------- 読み取り ----------------

export const OS_READ_TOOLS: OsToolDef[] = [
  def({
    name: "search_customers", kind: "read", title: "顧客を検索",
    description: "顧客（取引先）を名前・担当者・業種で検索する（グループ全社分。isMine が自拠点）。status: PROSPECT / ACTIVE / INACTIVE / BLOCKED。",
    input: z.object({ query: z.string().optional(), status: z.string().optional(), limit: z.number().int().optional() }),
    run: (v, a) => os.searchCustomers(v, a),
  }),
  def({
    name: "list_deals", kind: "read", title: "商談一覧",
    description: "商談の一覧（グループ全社分。金額は自拠点と本部だけ）。status: PROSPECTING / QUALIFYING / PROPOSAL / NEGOTIATION / CLOSED_WON / CLOSED_LOST / DORMANT / DEFERRED。",
    input: z.object({ query: z.string().optional(), status: z.string().optional(), customerId: z.string().optional(), limit: z.number().int().optional() }),
    run: (v, a) => os.listDeals(v, a),
  }),
  def({
    name: "get_deal", kind: "read", title: "商談の詳細",
    description: "商談1件（メモ・活動ログ最新20件つき）。id は list_deals のもの。",
    input: z.object({ id: z.string() }),
    run: (v, a) => os.getDeal(v, a.id),
    uiTemplate: UI_DEAL_CARD,
  }),
  def({
    name: "list_estimates", kind: "read", title: "見積一覧",
    description: "見積の一覧（金額は自拠点と本部だけ）。status: DRAFT / ISSUED / SENT / ACCEPTED / REJECTED。",
    input: z.object({ query: z.string().optional(), status: z.string().optional(), limit: z.number().int().optional() }),
    run: (v, a) => os.listEstimates(v, a),
  }),
  def({
    name: "get_estimate", kind: "read", title: "見積の詳細",
    description: "見積1件（品目・数量。金額は自拠点と本部だけ）。id は list_estimates のもの。",
    input: z.object({ id: z.string() }),
    run: (v, a) => os.getEstimate(v, a.id),
  }),
  def({
    name: "list_packages", kind: "read", title: "パッケージ台帳（稼働中）",
    description: "グループ共通の販売パッケージ一覧（slug・名前・価格・対象業種）。詳細は get_package(slug)。",
    input: z.object({}),
    run: () => os.listPackagesLite(),
  }),
  def({
    name: "get_package", kind: "read", title: "パッケージの詳細",
    description: "パッケージ1件（課題・内容物・オプション・トーク・ルール・事例）。",
    input: z.object({ slug: z.string() }),
    run: (v, a) => os.getPackage(v, a.slug),
  }),
  def({
    name: "tver_area_plan", kind: "read", title: "TVer エリア別プラン",
    description: "都道府県＋市区町村のTVer広告プラン（税抜・推計）。商圏のTVer視聴者数、3人に1人に届ける標準プラン、月額別の到達目安を返す。allCities: true で県内の全市区町村を人口の多い順に一度に返す（どの市から当たるかを決めるとき。市を1つずつ呼ばない）。",
    input: z.object({ prefecture: z.string().describe("例: 佐賀県"), city: z.string().optional().describe("例: 唐津市（省略で県内の先頭）"), allCities: z.boolean().optional().describe("県内の全市区町村をまとめて") }),
    run: (_v, a) => os.tverAreaPlan(a),
  }),
  def({
    name: "tver_results", kind: "read", title: "TVer配信実績（自拠点・本部確認済み）",
    description: "自拠点（本部は全社）のTVer配信実績＝本部が確認して公開したものだけ。reportId を渡すと表示回数・完全視聴率・CTR・金額（税抜）に加え、都道府県別・デバイス別・性別年齢別・日別の内訳を返す。お客様への報告・次回提案に使う。省略すると一覧。",
    input: z.object({ reportId: z.string().optional().describe("一覧の id。詳細が要る時"), advertiser: z.string().optional().describe("広告主名で絞る"), limit: z.number().int().optional().describe("既定20・最大50") }),
    run: (v, a) => tv.tverResults(v, a),
  }),
  def({
    name: "tver_benchmarks", kind: "read", title: "TVer実績ベンチマーク（グループ横断）",
    description: "グループ全社のTVer配信実績を「どの規模の市町村（人口帯）で・月いくら打つと（月額帯）・どうなったか（30日あたり表示回数・到達人数・住民比・完全視聴率・CTR・年齢/デバイス構成）」で引く。提案前・見積前・『効果はどのくらい？』『この市で月◯万だとどれくらい？』に呼ぶ。市名か人口と、想定の月額を渡すと近い帯の実績だけを返す。他拠点の案件は広告主名を伏せ金額は帯だけ＝比率と規模を『型』として借りる。",
    input: z.object({ industry: z.string().optional().describe("例: 建設 / 歯科 / 飲食"), prefecture: z.string().optional().describe("例: 福岡県"), city: z.string().optional().describe("例: 久留米市（prefecture と一緒に。人口をマスターから引く）"), population: z.number().int().optional().describe("商圏の人口を直接渡す時"), monthlyBudget: z.number().int().optional().describe("想定の月額（税抜・円）。近い月額帯の実績に絞る"), adSeconds: z.number().int().optional().describe("15 / 30 / 60"), limit: z.number().int().optional().describe("既定12・最大30") }),
    run: (v, a) => tv.tverBenchmarks(v, a),
  }),
  def({
    name: "search_wiki", kind: "read", title: "本部Wikiを検索",
    description: "OSのWiki記事をキーワードで検索（手順・決まり・事例）。本文は先頭4,000字。全文は get_wiki(id)。",
    input: z.object({ query: z.string(), limit: z.number().int().optional() }),
    run: (v, a) => os.searchWiki(v, a),
  }),
  def({
    name: "list_wiki", kind: "read", title: "Wikiの目次",
    description: "OSのWiki記事の一覧（題名・タグ・更新日・冒頭120字）。「Wikiに何がある？」に答える。tag で絞れる。全文は get_wiki(id)。",
    input: z.object({ tag: z.string().optional(), limit: z.number().int().optional().describe("既定50・最大100") }),
    run: (v, a) => os.listWiki(v, a),
  }),
  def({
    name: "get_wiki", kind: "read", title: "Wiki記事を全文で読む",
    description: "Wiki記事1本の全文。id は list_wiki / search_wiki のもの。",
    input: z.object({ id: z.string() }),
    run: (v, a) => os.getWiki(v, a.id),
  }),
  def({
    name: "search_knowledge", kind: "read", title: "資料ライブラリを検索（OSの頭脳）",
    description: "本部が登録した媒体資料・提案書・他社資料をキーワードで検索し、AIの整理（使える中身／価格の扱い／実績の扱い）を返す。origin: OWN=自社（そのまま応用可）/ EXTERNAL=他社・媒体社（仕組みは参考。価格は卸値＝販売価格はOSの正本。実績は他社分）。全文は get_knowledge(id)。",
    input: z.object({ query: z.string(), origin: z.string().optional().describe("OWN / EXTERNAL（省略で両方）"), limit: z.number().int().optional().describe("既定5・最大10") }),
    run: (v, a) => os.searchKnowledgeTool(v, a),
  }),
  def({
    name: "list_knowledge", kind: "read", title: "資料ライブラリの目次",
    description: "資料ライブラリの一覧（題名・出どころ・発行元・年月・要約）。「どんな資料がある？」に答える。全文は get_knowledge(id)。",
    input: z.object({ origin: z.string().optional().describe("OWN / EXTERNAL"), limit: z.number().int().optional().describe("既定50・最大100") }),
    run: (v, a) => os.listKnowledge(v, a),
  }),
  def({
    name: "get_knowledge", kind: "read", title: "資料を全文で読む",
    description: "資料ライブラリの1件（要約・AIの整理・全文）。全文は12,000字ずつ part で分けて返す（parts が総数）。id は search_knowledge / list_knowledge のもの。",
    input: z.object({ id: z.string(), part: z.number().int().optional().describe("1始まり（既定1）") }),
    run: (v, a) => os.getKnowledge(v, a.id, a.part),
  }),
  def({
    name: "my_next_actions", kind: "read", title: "今日の一手",
    description:
      "「今日何する」「朝の確認」に答える材料。自分の拠点に絞って 1) 返事待ちが7日超 2) 見込み日を過ぎた商談 3) 30日動いていない商談 4) 3か月以内に周年（自県） 5) 使える補助金 6) 今週シグナルが立った会社（自県）を返す。1→6 の順に優先し、3〜8行にまとめて提案する。各項目の next に次に呼ぶツールが入っている。金額は含まない。",
    input: z.object({ limit: z.number().int().optional().describe("各項目の件数（既定5・最大10）") }),
    run: (v, a) => os.myNextActions(v, a),
    uiTemplate: UI_NEXT_ACTIONS,
  }),
  def({
    name: "my_summary", kind: "read", title: "自分の数字",
    description: "商談の状況別件数（月次報告の売上額は本部のみ）。",
    input: z.object({ months: z.number().int().optional().describe("何か月分（既定3・最大12）") }),
    run: (v, a) => os.mySummary(v, a),
  }),
  def({
    name: "list_group_companies", kind: "read", title: "グループ拠点一覧",
    description: "稼働中の加盟各社（社名・代表・県・得意分野・サイト）。",
    input: z.object({}),
    run: () => os.listGroupCompanies(),
  }),
  def({
    name: "list_leads", kind: "read", title: "リード一覧",
    description: "グループのリード（見込み先）。mine: true で自分の担当だけ、waitingReply: true で「送付済み・結果未入力」だけ、phoneCandidates: true で「電話でしか当たれない先（メール・フォームが使えず電話に回した先）」だけ。status: UNTOUCHED / CALLED / APPOINTMENT / DEAL_CONVERTED。結果の記録は record_lead_result。",
    input: z.object({ query: z.string().optional(), status: z.string().optional(), mine: z.boolean().optional(), waitingReply: z.boolean().optional(), phoneCandidates: z.boolean().optional(), limit: z.number().int().optional() }),
    run: (v, a) => os.listLeads(v, a),
  }),
  def({
    name: "list_activities", kind: "read", title: "活動履歴（会話の記録）",
    description: "顧客または商談の過去のやり取りを新しい順に返す。customerId なら顧客の活動履歴＋その顧客の全商談ログ、dealId なら商談ログだけ。提案や連絡の前に必ず読む。",
    input: z.object({ customerId: z.string().optional(), dealId: z.string().optional(), limit: z.number().int().optional().describe("既定30・最大100") }),
    run: (v, a) => osw.listActivities(v, a),
  }),
  def({
    name: "find_similar_wins", kind: "read", title: "似た案件の勝ち筋（決め手・効いた文面）",
    description:
      "グループ全社の受注商談の「決め手」と、前向きな返信を取ったアプローチ文面を、業種・都道府県・パッケージ・キーワードで横断して引く。提案を書く前、断られた後、初めての業種に当たる前に呼ぶ。固有名詞と金額は写さず「型」として借りる。",
    input: z.object({ industry: z.string().optional().describe("例: 歯科 / 工務店 / 飲食"), prefecture: z.string().optional().describe("例: 佐賀県"), packageSlug: z.string().optional().describe("list_packages の slug"), query: z.string().optional().describe("決め手・文面に含まれる語"), limit: z.number().int().optional().describe("既定8・最大20") }),
    run: (v, a) => ins.findSimilarWins(v, a),
  }),
  def({
    name: "draft_proposal", kind: "read", title: "提案書の材料を1コールで束ねる",
    description:
      "顧客（customerId）向けの提案文・提案資料を書くための材料を一度に返す＝顧客情報と過去のやり取り・進行中の商談・パッケージ（packageSlug）・ブランドキット（決まり／会社紹介／営業の言い回し／そのパッケージ）・似た案件の勝ち筋・財源になる補助金・TVerプラン（tverPrefecture/tverCity）。返ってきた writingGuide の順に書く。数字には「目安・税抜」を添える。",
    input: z.object({ customerId: z.string(), packageSlug: z.string().optional(), materialIds: z.array(z.string()).optional().describe("ブランドキットの材料id（既定: brand-rules, company, sales, pkg-<slug>）"), tverPrefecture: z.string().optional(), tverCity: z.string().optional() }),
    run: (v, a) => ins.draftProposal(v, a),
  }),
  def({
    name: "plan_campaign", kind: "read", title: "市×業界で、まとめて当たる計画",
    description:
      "「◯◯市の◯◯業界に営業したい」に1コールで答える。OSのリード（担当なし／自分）を、今週のシグナル・周年・AIスコア・連絡手段で「当たりやすい順」に並べ、営業お断りと全社の送付済み台帳で除外し、訴求の型（全社の受注の決め手・返信が来た文面）、勧めるパッケージ、財源になる補助金、着地URL（TVer申込ページ・公式LINE・LP）を返す。次は prepare_outreach。",
    input: z.object({ prefecture: z.string().describe("例: 佐賀県"), city: z.string().optional().describe("例: 唐津市（省略で県全体）"), industry: z.string().describe("例: 歯科 / 工務店 / 飲食"), packageSlug: z.string().optional(), limit: z.number().int().optional().describe("既定20・最大50") }),
    run: (v, a) => camp.planCampaign(v, a),
  }),
  def({
    name: "list_landing_pages", kind: "read", title: "営業用LPの一覧",
    description: "AIが作った業種×市のLP（/lp/…）の一覧。mine: true で自拠点だけ。",
    input: z.object({ mine: z.boolean().optional(), limit: z.number().int().optional() }),
    run: (v, a) => camp.listLandingPages(v, a),
  }),
  def({
    name: "my_week", kind: "read", title: "この1週間の自拠点の事実（週次共有の材料）",
    description:
      "「週次を出して」「今週の週次」に答える材料。過去7日の自拠点の記録＝声をかけた先（送付済みリード）・返事とアポ・活動記録（顧客/商談/営業活動）・動いた商談・いちばん近い受注候補・先週の週次で書いた『来週やること』・今週の提出の有無を1コールで返す。返った材料から 声かけ数・返事数・受注候補 を埋め、先週の次の一手の答え合わせと本部への依頼を本人に聞いてから submit_weekly_share で提出する。金額は含まない。加盟代表のみ。",
    input: z.object({ days: z.number().int().optional().describe("さかのぼる日数（既定7・3〜14）") }),
    run: (v, a) => wk.myWeek(v, a),
  }),
  def({
    name: "list_ad_buyers", kind: "read", title: "広告出稿者（有料媒体に載っている店）の一覧",
    description:
      "すでに有料媒体に掲載している＝広告費を払っている地元の店を県・市で返す（広告出稿者ファインダーで保存済みのリードだけ。新しく探すのはOS画面 /dashboard/ad-buyer-finder）。platform は " +
      AD_PLATFORMS.map((p) => `${p.key}(${p.label}・確度${p.paidConfidence === "high" ? "高" : "中"})`).join(" / ") +
      "。ホットペッパービューティーは実質有料掲載のみ＝掲載店は今か過去に広告費を払っている。食べログ等は無料枠があるため『中』。金額は持たない。",
    input: z.object({
      prefecture: z.string().describe("都道府県（例: 香川県）"),
      city: z.string().optional().describe("市区町村（例: 高松市）"),
      platform: z.string().optional().describe("媒体キー（例: hotpepper_beauty）"),
      industry: z.string().optional().describe("業種（例: 美容室）"),
      limit: z.number().int().optional().describe("既定50・最大200"),
    }),
    run: (v, a) => listAdBuyers(v, { ...a, limit: Math.min(200, Math.max(1, Math.floor(a.limit ?? 50))) }),
  }),
];

// ---------------- 書き込み ----------------

export const OS_WRITE_TOOLS: OsToolDef[] = [
  def({
    name: "log_activity", kind: "write", title: "活動を記録（会話の要約を残す）",
    description: "電話・メール・訪問・Web会議・その他のやり取りを、顧客（customerId）または商談（dealId）に1件記録する。会話で営業のやり取りが出たら、相手・要点・次の一手を3〜8行にまとめて残す。type: CALL / EMAIL / VISIT / MEETING / OTHER。occurredAt は YYYY-MM-DD（省略で今日）。",
    input: z.object({ customerId: z.string().optional(), dealId: z.string().optional(), type: z.string().optional(), content: z.string(), occurredAt: z.string().optional() }),
    run: (v, a) => osw.logActivity(v, a),
    confirm: (a) => `活動を記録します（${a.dealId ? "商談" : "顧客"}・${a.type ?? "OTHER"}）:\n${a.content.slice(0, 300)}`,
  }),
  def({
    name: "create_customer", kind: "write", title: "顧客を登録",
    description: "会話に出た新しい取引先・見込み客を貴社の顧客として登録する。登録前に search_customers で重複を確認する。status: PROSPECT / ACTIVE / INACTIVE、rank: A / B / C。金額は入れない。",
    input: z.object({ name: z.string(), nameKana: z.string().optional(), contactName: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), website: z.string().optional(), industry: z.string().optional(), prefecture: z.string().optional(), address: z.string().optional(), notes: z.string().optional(), status: z.string().optional(), rank: z.string().optional() }),
    run: (v, a) => osw.createCustomer(v, a),
    confirm: (a) => `顧客「${a.name}」を登録します（${a.industry ?? "業種未設定"}・${a.prefecture ?? ""}）`,
  }),
  def({
    name: "update_customer", kind: "write", title: "顧客を更新（社名・担当者・連絡先・状態・備考追記）",
    description: "既存顧客（id）の name / nameKana / contactName / phone / email / website / industry / prefecture / address / status / rank を更新する。渡した項目だけ変わる（空文字で消す）。備考は appendNote で追記（上書きしない）。社名変更・担当者交代・住所移転・取引状態の変更に使う。変更はOS画面と同じ形で活動履歴に残る。取引回避（BLOCKED）はOS画面で。金額は入れない。",
    input: z.object({ id: z.string(), name: z.string().optional(), nameKana: z.string().optional(), contactName: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), website: z.string().optional(), industry: z.string().optional(), prefecture: z.string().optional(), address: z.string().optional(), status: z.string().optional(), rank: z.string().optional(), appendNote: z.string().optional() }),
    run: (v, a) => osw.updateCustomer(v, a),
    confirm: (a) => `顧客を更新します: ${[a.name && `社名→${a.name}`, a.contactName && `担当者→${a.contactName}`, a.status && `状態→${a.status}`, a.rank && `ランク→${a.rank}`, a.phone && `電話→${a.phone}`, a.email && `メール→${a.email}`, a.address && `住所→${a.address}`, a.appendNote && `備考追記「${a.appendNote.slice(0, 120)}」`].filter(Boolean).join(" / ") || "その他の項目"}`,
  }),
  def({
    name: "create_deal", kind: "write", title: "商談を起こす",
    description: "既存顧客（customerId）に商談を1件作る。status: PROSPECTING / QUALIFYING / PROPOSAL / NEGOTIATION（受注は作成後に update_deal で CLOSED_WON）。probability は 0〜100、expectedCloseDate は YYYY-MM-DD。進行中の商談が既にある顧客は止まるので、別件なら allowDuplicate: true。金額は入れない。",
    input: z.object({ customerId: z.string(), title: z.string(), status: z.string().optional(), probability: z.number().int().optional(), expectedCloseDate: z.string().optional(), notes: z.string().optional(), allowDuplicate: z.boolean().optional() }),
    run: (v, a) => osw.createDeal(v, a),
    confirm: (a) => `商談「${a.title}」を起こします（${a.status ?? "PROSPECTING"}${a.expectedCloseDate ? `・見込み ${a.expectedCloseDate}` : ""}）`,
  }),
  def({
    name: "update_deal", kind: "write", title: "商談を更新（状態・確度・予定日・メモ追記）",
    description: "商談（id）の status / probability / expectedCloseDate を更新し、appendNote でメモを追記する（上書きはしない）。失注は CLOSED_LOST。受注は CLOSED_WON＝OS画面で受注にしたときと同じく受注日の記録・プロジェクト自動作成・本部への受注通知が動く（受注済みの商談は変更できない）。受注にしたら set_closing_factor で決め手も残す。",
    input: z.object({ id: z.string(), status: z.string().optional(), probability: z.number().int().optional(), expectedCloseDate: z.string().optional(), appendNote: z.string().optional() }),
    run: (v, a) => osw.updateDeal(v, a),
    confirm: (a) => `商談を更新します: ${[a.status && (a.status.toUpperCase() === "CLOSED_WON" ? "受注に確定（プロジェクト自動作成・本部に通知）" : `状態→${a.status}`), a.probability !== undefined && `確度→${a.probability}%`, a.expectedCloseDate && `見込み→${a.expectedCloseDate}`, a.appendNote && `メモ追記「${a.appendNote.slice(0, 120)}」`].filter(Boolean).join(" / ")}`,
  }),
  def({
    name: "set_closing_factor", kind: "write", title: "受注の決め手を記録",
    description: "受注した（またはほぼ決まった）商談（id）に「何が決め手だったか」を残す。文面・提案内容・関係性・タイミングなど。グループの成功事例学習に使う（find_similar_wins で全員が引ける）。",
    input: z.object({ id: z.string(), closingFactor: z.string() }),
    run: (v, a) => osw.setClosingFactor(v, a),
    confirm: (a) => `受注の決め手を残します:\n${a.closingFactor.slice(0, 300)}`,
  }),
  def({
    name: "create_lead", kind: "write", title: "OS外で取ったリードを登録",
    description: "紹介・飛び込み・自分で見つけた等、OSを使わずに得た見込み先をリードとして登録する（担当は自分）。同名＋同住所が既にあればそれを返す。status: UNTOUCHED / CALLED / APPOINTMENT。",
    input: z.object({ name: z.string(), address: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), website: z.string().optional(), industry: z.string().optional(), area: z.string().optional().describe("例: 佐賀県唐津市"), memo: z.string().optional(), status: z.string().optional() }),
    run: (v, a) => osw.createLead(v, a),
    confirm: (a) => `リード「${a.name}」を登録します（${a.industry ?? "業種未設定"}・${a.area ?? a.address ?? ""}）`,
  }),
  def({
    name: "record_lead_result", kind: "write", title: "リードの結果を記録",
    description: "リード（leadId）の結果をOSに残す。result: REPLIED（返信あり）/ REPLIED_NG（返信NG）/ NO_REPLY（無反応）/ REJECTED（断り）/ WON（受注）＝OS画面の結果ボタンと同じ処理（ステータス移動・グループ事例DBへの反映）。status で APPOINTMENT（アポ獲得）等に直接進められる。note で経緯を残す。phoneCandidate: true で「メール・フォームが使えない先」を電話候補に回す＝my_next_actions と list_leads(phoneCandidates) に出る。まとめて記録するなら record_lead_results。会話でリードの結果が分かったら、聞かれてなくても記録する。",
    input: z.object({ leadId: z.string(), result: z.string().optional(), status: z.string().optional(), note: z.string().optional(), phoneCandidate: z.boolean().optional().describe("メール・フォームが使えない先を電話候補に回す（電話番号が要る）") }),
    run: (v, a) => osw.recordLeadResult(v, a),
    confirm: (a) => `リードの結果を記録します: ${[a.result && `結果=${a.result}`, a.status && `状態=${a.status}`, a.note && `メモ「${a.note.slice(0, 120)}」`].filter(Boolean).join(" / ")}`,
  }),
  def({
    name: "record_lead_results", kind: "write", title: "リードの結果をまとめて記録（最大50件）",
    description:
      "発掘した先を上から選別したときに、結果をまとめて1回で記録する（1件ずつ record_lead_result を何十回も呼ばない）。items の1件ずつは record_lead_result と同じ（leadId / result / status / note / phoneCandidate）。対象外にするなら status: SKIPPED と note（理由）。失敗したものだけ failed に返るので、残りは止まらない。",
    input: z.object({
      items: z.array(z.object({
        leadId: z.string(),
        result: z.string().optional(),
        status: z.string().optional().describe("UNTOUCHED / CALLED / APPOINTMENT / DEAL_CONVERTED / SKIPPED"),
        note: z.string().optional().describe("理由・経緯（例: フォームに営業お断りの記載）"),
        phoneCandidate: z.boolean().optional(),
      })).min(1).max(50),
    }),
    run: (v, a) => osw.recordLeadResults(v, a),
    confirm: (a) => `${a.items.length}件のリードの結果をまとめて記録します（対象外 ${a.items.filter((i) => i.status === "SKIPPED").length}件 / 電話候補 ${a.items.filter((i) => i.phoneCandidate).length}件）`,
  }),
  def({
    name: "submit_weekly_share", kind: "write", title: "週次共有を提出（グループサポート・行動量型）",
    description:
      "本部のグループサポートに週次共有を出す＝OS画面の週次フォームと同じ処理（同じ週は上書き・本部への依頼があれば本部に即時通知）。先に my_week で材料を読み、下書きを本人に見せて直してもらってから呼ぶ。outreachCount=今週新しく声をかけた先（件・OSの送付記録＋本人の補足）、repliedCount=そのうち返事があった・会えた（件）、candidate=いちばん受注に近い1件（相手・次の一手・いつまで。無ければ省略）、followUp=先週の『次の一手』は動いたか DONE/PARTIAL/NOT（先週の提出が無ければ省略）、hqRequest=本部に頼みたいこと NEW_PLAN/MEDIA_TERMS/JOINT_PROPOSAL/CASES/PRICING/NONE（本人が選ぶ）。ステータスは声かけ数で自動。数字と相手先名は記録にあるものだけ。金額は書かない。加盟代表のみ。",
    input: z.object({
      outreachCount: z.number().int().describe("今週、新しく声をかけた先（件・0可）"),
      hqRequest: z.string().describe("NEW_PLAN / MEDIA_TERMS / JOINT_PROPOSAL / CASES / PRICING / NONE"),
      hqNote: z.string().optional().describe("依頼の一言（相手先・業種・いつまで など・任意）"),
      repliedCount: z.number().int().optional().describe("返事があった・会えた（件）"),
      candidate: z.string().optional().describe("いちばん受注に近い1件（相手・次の一手・いつまで・500字以内）"),
      followUp: z.string().optional().describe("DONE / PARTIAL / NOT"),
      followUpNote: z.string().optional().describe("やってない・途中の理由（1行）"),
    }),
    run: (v, a) => wk.submitWeeklyShare(v, a),
    confirm: (a) => `週次共有を本部に提出します:\n声かけ ${a.outreachCount}件${a.repliedCount != null ? ` / 返事 ${a.repliedCount}件` : ""}\n候補: ${a.candidate ?? "なし"}\n先週の次の一手: ${a.followUp ?? "—"}${a.followUpNote ? `（${a.followUpNote.slice(0, 80)}）` : ""}\n本部への依頼: ${a.hqRequest}${a.hqNote ? ` — ${a.hqNote.slice(0, 120)}` : ""}`,
  }),
  def({
    name: "discover_leads", kind: "write", title: "新規リードを探す（リード獲得AI＝Google検索→AI採点→保存）",
    description:
      "OSにまだ無い会社を、市区町村×業種で新しく探す。OS画面の「リード獲得AI」と同じ＝Google Placesで企業を集め、Webサイト分析と全社の成功プロファイル・今日の判定基準でAIが採点し、リードとして保存する（担当は本人・同名＋同住所は1件・既存は採点だけ更新）。未送付のリードが100件以上あると保存は止まる。保存した先はその場でサイトを1回見て、メールを補完し、営業お断りの会社を対象外にして全社の送付禁止リストへ入れる（cleanup）。チェーン・FC・支店は本部決裁で市の商圏の話が通らないため既定で保存しない（excludeChains: false で戻せる）。dryRun: true で採点だけ見る。1回10社が目安（最大20）。続けて plan_campaign → prepare_outreach。",
    input: z.object({ prefecture: z.string().describe("例: 佐賀県"), city: z.string().optional().describe("例: 唐津市"), industry: z.string().describe("例: 歯科医院 / 工務店 / 飲食店"), keywords: z.string().optional().describe("検索語を変えたい時（例: 矯正歯科）"), count: z.number().int().optional().describe("既定10・最大20"), dryRun: z.boolean().optional(), excludeChains: z.boolean().optional().describe("チェーン・FC・支店を保存しない（既定 true）"), skipEnrich: z.boolean().optional().describe("メール補完と営業お断り判定をしない（既定 false）") }),
    run: (v, a) => discoverLeads({ id: v.id, email: v.email, name: v.name, branchId: v.branchId, branchId2: v.branchId2 }, a),
    confirm: (a) => `${[a.prefecture, a.city].filter(Boolean).join("")}の「${a.industry}」を${a.count ?? 10}社、Googleから探してAI採点し、${a.dryRun ? "保存せずに見せます" : "貴社のリードとして保存します"}`,
  }),
  def({
    name: "prepare_outreach", kind: "write", title: "営業メールをGmailの下書きにする（送付を記録）",
    description:
      "AIが書いた件名と本文を、そのリード宛の Gmail 下書きリンクにする。同時にOSの送付フローと同じ記録（全社の送付済み台帳・リードの送付日・事例DBの元）を残す。送信ボタンは人が押す（無人送信はしない）。営業お断り・他拠点の送付済み・自拠点が1か月以内に送った先（1か月ルール）は止まる。金額は本文に書かない。メールが無い会社は formPaste（フォームURL＋そのまま貼れる件名と本文＋手順）で返す＝貼って送信を押すのは人。",
    input: z.object({ leadId: z.string(), subject: z.string().describe("件名（120字以内）"), body: z.string().describe("本文（4000字以内・金額なし）"), appeal: z.string().optional().describe("訴求の切り口を一言（例: 周年×TVer）"), packageSlug: z.string().optional(), resend: z.boolean().optional().describe("1か月以内に自拠点が送った先へ、承知のうえで送り直す") }),
    run: (v, a) => camp.prepareOutreach(v, a),
    confirm: (a) => `営業メールを下書きにし、送付として記録します:\n件名: ${a.subject}\n${a.body.slice(0, 200)}…`,
  }),
  def({
    name: "create_landing_page", kind: "write", title: "業種×市の営業用LPを作る",
    description:
      "AIが文面（大見出し・サブ・2〜6段落）を書き、/lp/<slug> として公開する。市のTVer視聴者数・標準プラン・月額目安とパッケージの内容物は表示のたびにOSから引くので、文面に数字を書かない。着地は既定でTVer申込ページ（自拠点が案内元）。useLine: true で自拠点の公式LINEボタンも付く。返ったURLを prepare_outreach の本文に添える。",
    input: z.object({ title: z.string(), headline: z.string(), subheadline: z.string().optional(), industry: z.string().optional(), prefecture: z.string().optional(), city: z.string().optional(), packageSlug: z.string().optional(), sections: z.array(z.object({ heading: z.string(), body: z.string() })), ctaLabel: z.string().optional(), ctaUrl: z.string().optional(), useLine: z.boolean().optional(), slug: z.string().optional().describe("URLの末尾（英小文字・数字・ハイフン。例: karatsu-dental）") }),
    run: (v, a) => camp.createLandingPage(v, a),
    confirm: (a) => `LPを公開します: ${a.title}（${[a.prefecture, a.city, a.industry].filter(Boolean).join("・")}・${a.sections.length}段落）`,
  }),
  def({
    name: "prepare_dm", kind: "write", title: "郵送DM（チラシDM）の材料を揃える（送付を記録）",
    description:
      "選んだリード（最大200件）に紙のチラシDMを送るための材料を1回で返す: ①汎用の宛名CSV（基本のラクスルDM用＝宛名テンプレに貼り替える） ②Webレター（日本郵便・急ぎ少部数向け）用の宛先CSV（Shift-JIS・見出しなし・そのままアップロード） ③A4チラシのたたき台PDF（貴社名入り・landingUrl のQR付き＝情報の整理まで。クリエイティブの仕上げは貴社） ④発送先リンクと手順と概算。同時にメール・フォームと同じ送付記録（送付台帳・リードの送付日・【DM・郵送】）を残す。住所の無い会社・営業お断り・他拠点送付済みは除く。郵便番号は住所から取り、無ければGoogleで補完し、取れないものは needsFix で返す。発送は貴社（使っている代表本人）が基本ラクスルDM（急ぎ少部数はWebレター）から行う。本部は送らない・費用は貴社。",
    input: z.object({
      leadIds: z.array(z.string()).min(1).max(200).describe("plan_campaign / list_leads の id"),
      prefecture: z.string().describe("チラシの商圏の県（例: 佐賀県）"),
      city: z.string().describe("チラシの商圏の市区町村（例: 唐津市）"),
      industry: z.string().optional().describe("相手の業種（チラシの見出しに使う）"),
      catchCopy: z.string().optional().describe("チラシのひとこと（40字以内・金額なし）"),
      landingUrl: z.string().optional().describe("QRの飛び先（create_landing_page のURL か TVer申込ページ）"),
      template: z.enum(["orange", "classic", "poster"]).optional().describe("チラシの型（既定 orange）"),
      adSeconds: z.number().int().optional().describe("15/30/60（既定15）"),
      budgetJpy: z.number().int().optional().describe("チラシに載せる想定媒体費（省略で標準）"),
    }),
    run: (v, a) => prepareDm(v, { ...a, source: "AI" }),
    confirm: (a) => `郵送DMの材料を作り、${a.leadIds.length}件を送付として記録します（${a.prefecture} ${a.city}${a.catchCopy ? `／${a.catchCopy}` : ""}）`,
  }),
  def({
    name: "create_local_ad", kind: "write", title: "地域限定のMeta広告を作る（少額・貴社の広告アカウントで）",
    description:
      "市を指定して、Facebook/Instagram に地域限定（中心から半径km）の少額広告を貴社の広告アカウントで作る。例: 唐津市に日額500円で7日、LPへ誘導。バナーは省略するとOSの数字で描く /api/banner/tver を使う。作成は PAUSED（配信ONは人が広告マネージャで／activate: true で最初からON）。貴社のMeta広告アカウントがOSに未接続（/dashboard/meta-ads）なら、送る内容の組み立て（dryRun）だけ返す。費用・運用は貴社のアカウント。",
    input: z.object({ name: z.string().describe("キャンペーン名"), prefecture: z.string(), city: z.string(), dailyBudgetJpy: z.number().int().describe("日額（円・100以上）"), days: z.number().int().describe("配信日数（1〜90）"), landingUrl: z.string().describe("LPかTVer申込ページのURL"), headline: z.string().describe("見出し（40字以内）"), primaryText: z.string().describe("本文（125字以内が目安）"), bannerUrl: z.string().optional().describe("PNG/JPGのURL。省略でOSの型バナー（SVG＝ドライラン用）"), radiusKm: z.number().optional(), activate: z.boolean().optional() }),
    run: async (v, a) => {
      if (v.role === "USER") throw new osw.WriteError("地域限定広告の作成は代表（MANAGER以上）のみです");
      const banner = a.bannerUrl ?? `${appUrl()}/api/banner/tver?${new URLSearchParams({ pref: a.prefecture, city: a.city, headline: a.headline }).toString()}`;
      const cfg = await resolveMetaConfig(v); // 呼んだ人の拠点の接続（本部は本部の行）。無ければ dryRun
      const r = await createLocalCampaign({ name: a.name, prefecture: a.prefecture, cityName: a.city, dailyBudgetJpy: a.dailyBudgetJpy, days: a.days, landingUrl: a.landingUrl, headline: a.headline, primaryText: a.primaryText, bannerUrl: banner, radiusKm: a.radiusKm, activate: a.activate }, cfg);
      return { ...r, bannerUrl: banner, account: cfg ? cfg.accountName : null, connectAt: cfg ? null : `${appUrl()}/dashboard/meta-ads` };
    },
    confirm: (a) => `Meta広告を作ります: ${a.prefecture}${a.city}・日額¥${a.dailyBudgetJpy}×${a.days}日・${a.activate ? "作成後すぐ配信" : "PAUSEDで作成"}`,
  }),
];

export const OS_TOOLS: OsToolDef[] = [...OS_READ_TOOLS, ...OS_WRITE_TOOLS];

/** Anthropic Messages API の tools 形式（OS内のアーチくん用）。zod v4 の JSON Schema 変換を使う */
export function toAnthropicTools(defs: OsToolDef[]): { name: string; description: string; input_schema: { type: "object"; properties?: Record<string, unknown>; required?: string[] } }[] {
  return defs.map((d) => {
    const js = z.toJSONSchema(d.input, { target: "draft-7", io: "input" }) as { properties?: Record<string, unknown>; required?: string[] };
    return { name: d.name, description: d.description, input_schema: { type: "object", properties: js.properties ?? {}, ...(js.required?.length ? { required: js.required } : {}) } };
  });
}

/** AIへの共通の決まり（MCPの instructions と アーチくんの system で同じ文を使う） */
export const OS_AI_RULES =
  "顧客・商談・見積・リードはグループ全社分が見える（他拠点の金額だけ非表示）。相手先の話をする前に search_customers / list_activities で過去のやり取りを読む。" +
  "「今日何する」「朝の確認」「やることある？」には先に my_next_actions を呼び、1→6 の順に3〜8行で提案する。決まり・手順・事例は list_wiki で目次を見てから get_wiki で全文を読む。媒体の仕様・配信面・条件・他社の提案の仕組みは search_knowledge（資料ライブラリ）で引き、返った rules（自社=そのまま／他社・媒体=価格は卸値・実績は他社分）を必ず守る。" +
  "提案文・提案資料を頼まれたら draft_proposal(customerId) を1回呼び、返った writingGuide の順に書く。初めての業種・断られた後・提案前は find_similar_wins で勝ち筋を引く。TVerの提案・見積・『効果はどのくらい？』『この市で月◯万だとどれくらい？』には tver_benchmarks(prefecture, city, monthlyBudget, industry) を先に呼び、matrix（人口帯×月額帯→30日あたり表示回数・到達人数・住民比・完全視聴率）を「目安・税抜」で添える。配信済みのお客様への報告は tver_results(reportId) の数字をそのまま使う（盛らない）。" +
  "「◯◯市の◯◯業界に営業したい」「まとめて当たりたい」には plan_campaign(prefecture, city, industry) を1回呼び、候補が少なければ discover_leads(prefecture, city, industry) で新しく探してから plan_campaign を呼び直す。targets を上から順に reasons（なぜ今か）を添えて示す。文面は pitch（決め手・返信が来た文面）を型として1社ずつ書き、prepare_outreach(leadId, subject, body) で Gmail の下書きにする。送信は人が押す。メールが無い相手は formPaste（フォームURL＋そのまま貼れる件名と本文＋手順）をそのまま人に渡す＝AIがフォームに投稿しない。送れない相手（画像認証・フォームなし）は record_lead_result(leadId, phoneCandidate: true, note: 理由) で電話候補に回す。選別の結果（対象外・電話候補）は1件ずつではなく record_lead_results(items) でまとめて記録する。どの市から当たるか迷ったら tver_area_plan(prefecture, allCities: true) を1回。着地が要れば create_landing_page で業種×市のLPを作り、URLを本文に添える。紙で当てたい（DM・チラシ）と言われたら prepare_dm(leadIds, prefecture, city, landingUrl) を1回呼び、返った files（チラシPDF・Webレター用CSV）と send（発送先リンク）と steps をそのまま示す。needsFix は手で補う先として列挙する。Meta広告は create_local_ad。" +
  "「週次を出して」「今週の週次」「本部への週次共有」には my_week を1回呼び、返った記録だけから 声かけ数・返事数・いちばん近い受注候補 を埋めて本人に見せ、先週の『次の一手』が動いたか（DONE/PARTIAL/NOT）と 本部に頼みたいこと（hqRequest）を本人に選んでもらってから submit_weekly_share で提出する（OSに無い声かけは本人に聞いて足す。盛らない）。" +
  "【記録の決まり】会話の中で営業のやり取り（電話・メール・訪問・商談の進み具合）や結果（アポ・商談化・受注・失注・断り）が出たら、ユーザーに頼まれなくても log_activity / update_deal / record_lead_result で OS に残す。記録する前に一言「OSに記録します」と伝え、要点を3〜8行にまとめる。新しい相手先は search_customers で重複を確認してから create_customer。金額は書かない。受注が決まったら update_deal(status: CLOSED_WON) で受注にし、set_closing_factor で決め手を残す。";
