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
import { createLocalCampaign } from "@/lib/meta-ads/local-campaign";
import { resolveMetaConfig } from "@/lib/meta-ads/account";
import { appUrl } from "@/lib/tver-order/service";

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
    description: "都道府県＋市区町村のTVer広告プラン（税抜・推計）。商圏のTVer視聴者数、3人に1人に届ける標準プラン、月額別の到達目安を返す。",
    input: z.object({ prefecture: z.string().describe("例: 佐賀県"), city: z.string().optional().describe("例: 唐津市（省略で県内の先頭）") }),
    run: (_v, a) => os.tverAreaPlan(a),
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
    description: "グループのリード（見込み先）。mine: true で自分の担当だけ、waitingReply: true で「送付済み・結果未入力」だけ。status: UNTOUCHED / CALLED / APPOINTMENT / DEAL_CONVERTED。結果の記録は record_lead_result。",
    input: z.object({ query: z.string().optional(), status: z.string().optional(), mine: z.boolean().optional(), waitingReply: z.boolean().optional(), limit: z.number().int().optional() }),
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
    name: "create_deal", kind: "write", title: "商談を起こす",
    description: "既存顧客（customerId）に商談を1件作る。status: PROSPECTING / QUALIFYING / PROPOSAL / NEGOTIATION（受注はOS画面で）。probability は 0〜100、expectedCloseDate は YYYY-MM-DD。進行中の商談が既にある顧客は止まるので、別件なら allowDuplicate: true。金額は入れない。",
    input: z.object({ customerId: z.string(), title: z.string(), status: z.string().optional(), probability: z.number().int().optional(), expectedCloseDate: z.string().optional(), notes: z.string().optional(), allowDuplicate: z.boolean().optional() }),
    run: (v, a) => osw.createDeal(v, a),
    confirm: (a) => `商談「${a.title}」を起こします（${a.status ?? "PROSPECTING"}${a.expectedCloseDate ? `・見込み ${a.expectedCloseDate}` : ""}）`,
  }),
  def({
    name: "update_deal", kind: "write", title: "商談を更新（状態・確度・予定日・メモ追記）",
    description: "商談（id）の status / probability / expectedCloseDate を更新し、appendNote でメモを追記する（上書きはしない）。失注は CLOSED_LOST。受注（CLOSED_WON）はOS画面で行う。",
    input: z.object({ id: z.string(), status: z.string().optional(), probability: z.number().int().optional(), expectedCloseDate: z.string().optional(), appendNote: z.string().optional() }),
    run: (v, a) => osw.updateDeal(v, a),
    confirm: (a) => `商談を更新します: ${[a.status && `状態→${a.status}`, a.probability !== undefined && `確度→${a.probability}%`, a.expectedCloseDate && `見込み→${a.expectedCloseDate}`, a.appendNote && `メモ追記「${a.appendNote.slice(0, 120)}」`].filter(Boolean).join(" / ")}`,
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
    description: "リード（leadId）の結果をOSに残す。result: REPLIED（返信あり）/ REPLIED_NG（返信NG）/ NO_REPLY（無反応）/ REJECTED（断り）/ WON（受注）＝OS画面の結果ボタンと同じ処理（ステータス移動・グループ事例DBへの反映）。status で APPOINTMENT（アポ獲得）等に直接進められる。note で経緯を残す。会話でリードの結果が分かったら、聞かれてなくても記録する。",
    input: z.object({ leadId: z.string(), result: z.string().optional(), status: z.string().optional(), note: z.string().optional() }),
    run: (v, a) => osw.recordLeadResult(v, a),
    confirm: (a) => `リードの結果を記録します: ${[a.result && `結果=${a.result}`, a.status && `状態=${a.status}`, a.note && `メモ「${a.note.slice(0, 120)}」`].filter(Boolean).join(" / ")}`,
  }),
  def({
    name: "prepare_outreach", kind: "write", title: "営業メールをGmailの下書きにする（送付を記録）",
    description:
      "AIが書いた件名と本文を、そのリード宛の Gmail 下書きリンクにする。同時にOSの送付フローと同じ記録（全社の送付済み台帳・リードの送付日・事例DBの元）を残す。送信ボタンは人が押す（無人送信はしない）。営業お断り・他拠点の送付済みは止まる。金額は本文に書かない。メールが無い会社はフォーム用の本文として返す。",
    input: z.object({ leadId: z.string(), subject: z.string().describe("件名（120字以内）"), body: z.string().describe("本文（4000字以内・金額なし）"), appeal: z.string().optional().describe("訴求の切り口を一言（例: 周年×TVer）"), packageSlug: z.string().optional() }),
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
    name: "create_local_ad", kind: "write", title: "地域限定のMeta広告を作る（少額・貴社の広告アカウントで）",
    description:
      "市を指定して、Facebook/Instagram に地域限定（中心から半径km）の少額広告を貴社の広告アカウントで作る。例: 唐津市に日額500円で7日、LPへ誘導。バナーは省略するとOSの数字で描く /api/banner/tver を使う。作成は PAUSED（配信ONは人が広告マネージャで／activate: true で最初からON）。貴社のMeta広告アカウントがOSに未接続（/dashboard/meta-ads）なら、送る内容の組み立て（dryRun）だけ返す。費用・運用は貴社のアカウント。",
    input: z.object({ name: z.string().describe("キャンペーン名"), prefecture: z.string(), city: z.string(), dailyBudgetJpy: z.number().int().describe("日額（円・100以上）"), days: z.number().int().describe("配信日数（1〜90）"), landingUrl: z.string().describe("LPかTVer申込ページのURL"), headline: z.string().describe("見出し（40字以内）"), primaryText: z.string().describe("本文（125字以内が目安）"), bannerUrl: z.string().optional().describe("PNG/JPGのURL。省略でOSの型バナー（SVG＝ドライラン用）"), radiusKm: z.number().optional(), activate: z.boolean().optional() }),
    run: async (v, a) => {
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
  "「今日何する」「朝の確認」「やることある？」には先に my_next_actions を呼び、1→6 の順に3〜8行で提案する。決まり・手順・事例は list_wiki で目次を見てから get_wiki で全文を読む。" +
  "提案文・提案資料を頼まれたら draft_proposal(customerId) を1回呼び、返った writingGuide の順に書く。初めての業種・断られた後・提案前は find_similar_wins で勝ち筋を引く。" +
  "「◯◯市の◯◯業界に営業したい」「まとめて当たりたい」には plan_campaign(prefecture, city, industry) を1回呼び、targets を上から順に reasons（なぜ今か）を添えて示す。文面は pitch（決め手・返信が来た文面）を型として1社ずつ書き、prepare_outreach(leadId, subject, body) で Gmail の下書きにする。送信は人が押す。着地が要れば create_landing_page で業種×市のLPを作り、URLを本文に添える。" +
  "【記録の決まり】会話の中で営業のやり取り（電話・メール・訪問・商談の進み具合）や結果（アポ・商談化・受注・失注・断り）が出たら、ユーザーに頼まれなくても log_activity / update_deal / record_lead_result で OS に残す。記録する前に一言「OSに記録します」と伝え、要点を3〜8行にまとめる。新しい相手先は search_customers で重複を確認してから create_customer。金額は書かない。受注の確定はOS画面で行うよう案内する。受注が決まったら set_closing_factor で決め手を残す。";
