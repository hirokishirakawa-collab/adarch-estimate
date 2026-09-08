// ==============================================================
// MCP エンドポイント（Streamable HTTP・ステートレス）
//   各代表の Claude / ChatGPT が「カスタムコネクタ」でここに繋ぐ。
//   認証 = OS内蔵OAuthのアクセストークン（Bearer）。呼び出しは全部 監査ログへ。
//   scope brand_kit : ブランドキット（材料一覧・1件・束ね）
//   scope os:read   : 全社の顧客・商談・見積・リード・活動履歴（他拠点の金額は非表示）・パッケージ台帳・TVerプラン・Wiki・自分の数字・拠点一覧
//   scope os:write  : 営業の記録（活動・顧客/商談/リードの登録・商談更新・決め手・リードの結果）＝各拠点のデータの吸い上げ
// ==============================================================

import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { buildAllMaterials, combineMaterials } from "@/lib/brand-kit/all-materials";
import { trackBrandKit } from "@/lib/brand-kit/track";
import { issuer, verifyAccessToken, type Scope } from "@/lib/oauth/server";
import * as os from "@/lib/mcp/os-read-tools";
import * as osw from "@/lib/mcp/os-write-tools";

export const maxDuration = 60;

type Ctx = { http?: { authInfo?: AuthInfo } };
interface Who {
  email: string;
  name: string | null;
  clientName: string | null;
  scopes: Scope[];
}

function who(ctx: Ctx): Who | null {
  const a = ctx.http?.authInfo;
  const extra = (a?.extra ?? {}) as Partial<Who>;
  if (!a || !extra.email) return null;
  return { email: extra.email, name: extra.name ?? null, clientName: extra.clientName ?? null, scopes: (a.scopes as Scope[]) ?? [] };
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 1));
const fail = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });

const NEED_BRAND = "この接続には「ブランドキット」の権限がありません。OSのブランドキット画面から接続し直してください。";
const NEED_OS = "この接続には「OSの読み取り」の権限がありません。OSのブランドキット画面から接続し直してください。";
const NEED_WRITE = "この接続には「営業の記録（書き込み）」の権限がありません。AI側でコネクタを一度切断し、連携し直して同意画面で許可してください。";

/** OS読み取り／書き込みの呼び出しを監査ログへ（失敗しても本体は止めない） */
function logOs(w: Who, tool: string, input: unknown, action: "mcp_os_read" | "mcp_os_write" = "mcp_os_read") {
  void logAudit({
    action,
    email: w.email,
    name: w.name,
    entity: "mcp_tool",
    entityId: tool,
    detail: `[${w.clientName ?? "AI"}] ${JSON.stringify(input ?? {})}`.slice(0, 1000),
  });
}

const handler = createMcpHandler(
  (server) => {
    // ---------------- ブランドキット ----------------
    server.registerTool(
      "list_materials",
      {
        title: "ブランドキットの材料一覧",
        description:
          "Ad Archグループのブランドキット（AI用材料）の一覧を返す。id・見出し・用途・版。提案文や資料を作る前に、まずこれを呼んで必要な材料を選ぶ。",
        inputSchema: z.object({}),
      },
      async (_args, ctx) => {
        const w = who(ctx as Ctx);
        if (!w) return fail("認証されていません");
        if (!w.scopes.includes("brand_kit")) return fail(NEED_BRAND);
        const { materials, sender } = await buildAllMaterials(w.email);
        trackBrandKit({ event: "mcp", kind: "mcp_list", items: ["一覧"], email: w.email, name: w.name, clientName: w.clientName });
        return json({
          company: sender.company,
          prefecture: sender.prefecture,
          materials: materials.map((m) => ({ id: m.id, group: m.group, label: m.label, note: m.note, version: m.version })),
          how_to_use: "get_material(id) で1件、get_full_kit(ids) で「AIをアドアーチ仕様にする」設定文つきの束を取れる。数字は材料に書いてあるものだけ使い、価格の正本は Ad Arch OS。",
        });
      },
    );

    server.registerTool(
      "get_material",
      {
        title: "ブランドキットの材料を1件取得",
        description: "材料1件の本文（Markdown）を返す。id は list_materials のもの。例: brand-rules（資料の型）, company（会社紹介）, sales（営業の言い回し）, パッケージやメディアのid, wiki-<id>。",
        inputSchema: z.object({ id: z.string().describe("材料のid") }),
      },
      async ({ id }, ctx) => {
        const w = who(ctx as Ctx);
        if (!w) return fail("認証されていません");
        if (!w.scopes.includes("brand_kit")) return fail(NEED_BRAND);
        const { materials } = await buildAllMaterials(w.email);
        const m = materials.find((x) => x.id === id);
        if (!m) return fail(`材料 ${id} が見つかりません。list_materials で id を確認してください`);
        trackBrandKit({ event: "mcp", kind: "mcp_one", items: [m.label], email: w.email, name: w.name, clientName: w.clientName });
        return text(m.body);
      },
    );

    server.registerTool(
      "get_full_kit",
      {
        title: "AIをアドアーチ仕様にする（設定文＋材料の束）",
        description:
          "OS画面の「AIをアドアーチ仕様にする」と同じ束（冒頭にAIへの指示、続けて選んだ材料）を返す。ids を省略すると全材料。長くなるので、普段は list_materials で選んで ids を渡す。",
        inputSchema: z.object({ ids: z.array(z.string()).optional().describe("材料idの配列。省略で全部") }),
      },
      async ({ ids }, ctx) => {
        const w = who(ctx as Ctx);
        if (!w) return fail("認証されていません");
        if (!w.scopes.includes("brand_kit")) return fail(NEED_BRAND);
        const { materials, sender } = await buildAllMaterials(w.email);
        const chosen = ids && ids.length > 0 ? materials.filter((m) => ids.includes(m.id)) : materials;
        if (chosen.length === 0) return fail("該当する材料がありません。list_materials で id を確認してください");
        trackBrandKit({ event: "mcp", kind: "mcp_all", items: chosen.map((m) => m.label), email: w.email, name: w.name, clientName: w.clientName });
        return text(combineMaterials(chosen, sender));
      },
    );

    // ---------------- OS 読み取り ----------------
    // 共通の前処理（認証→scope→利用者→監査ログ→実行）を1か所に。型はSDKの多重定義に合わせて呼び出し側でキャスト
    const osTool = <A extends z.ZodType>(
      name: string,
      cfg: { title: string; description: string; inputSchema: A },
      run: (viewer: os.McpViewer, args: z.infer<A>) => Promise<unknown> | unknown,
    ) => {
      const cb = async (args: z.infer<A>, ctx: Ctx) => {
        const w = who(ctx);
        if (!w) return fail("認証されていません");
        if (!w.scopes.includes("os:read")) return fail(NEED_OS);
        const viewer = await os.loadViewer(w.email);
        if (!viewer) return fail("このアカウントは利用できません");
        logOs(w, name, args);
        try {
          const out = await run(viewer, args);
          if (out == null) return fail("見つかりませんでした（貴社の拠点の範囲外か、存在しないIDです）");
          return json(out);
        } catch (e) {
          console.error(`[MCP] ${name} 失敗:`, e);
          return fail("取得に失敗しました。時間をおいて再度お試しください");
        }
      };
      type Reg = Parameters<typeof server.registerTool>;
      server.registerTool(name, { ...cfg, annotations: { readOnlyHint: true } } as unknown as Reg[1], cb as unknown as Reg[2]);
    };

    osTool(
      "search_customers",
      { title: "顧客を検索", description: "貴社拠点の顧客（取引先）を名前・担当者・業種で検索する。status: PROSPECT / ACTIVE / INACTIVE / BLOCKED。", inputSchema: z.object({ query: z.string().optional(), status: z.string().optional(), limit: z.number().int().optional() }) },
      (v, a) => os.searchCustomers(v, a),
    );
    osTool(
      "list_deals",
      { title: "商談一覧", description: "貴社拠点の商談（金額は本部のみ）。status: PROSPECTING / QUALIFYING / PROPOSAL / NEGOTIATION / CLOSED_WON / CLOSED_LOST / DORMANT / DEFERRED。", inputSchema: z.object({ query: z.string().optional(), status: z.string().optional(), customerId: z.string().optional(), limit: z.number().int().optional() }) },
      (v, a) => os.listDeals(v, a),
    );
    osTool(
      "get_deal",
      { title: "商談の詳細", description: "商談1件（メモ・活動ログ最新20件つき）。id は list_deals のもの。", inputSchema: z.object({ id: z.string() }) },
      (v, a) => os.getDeal(v, a.id),
    );
    osTool(
      "list_estimates",
      { title: "見積一覧", description: "貴社拠点の見積。status: DRAFT / ISSUED / SENT / ACCEPTED / REJECTED。", inputSchema: z.object({ query: z.string().optional(), status: z.string().optional(), limit: z.number().int().optional() }) },
      (v, a) => os.listEstimates(v, a),
    );
    osTool(
      "get_estimate",
      { title: "見積の詳細", description: "見積1件（品目・数量。金額は本部のみ）。id は list_estimates のもの。", inputSchema: z.object({ id: z.string() }) },
      (v, a) => os.getEstimate(v, a.id),
    );
    osTool(
      "list_packages",
      { title: "パッケージ台帳（稼働中）", description: "グループ共通の販売パッケージ一覧（slug・名前・価格・対象業種）。詳細は get_package(slug)。", inputSchema: z.object({}) },
      () => os.listPackagesLite(),
    );
    osTool(
      "get_package",
      { title: "パッケージの詳細", description: "パッケージ1件（課題・内容物・オプション・トーク・ルール・事例）。", inputSchema: z.object({ slug: z.string() }) },
      (v, a) => os.getPackage(v, a.slug),
    );
    osTool(
      "tver_area_plan",
      { title: "TVer エリア別プラン", description: "都道府県＋市区町村のTVer広告プラン（税抜・推計）。商圏のTVer視聴者数、3人に1人に届ける標準プラン、月額別の到達目安を返す。", inputSchema: z.object({ prefecture: z.string().describe("例: 佐賀県"), city: z.string().optional().describe("例: 唐津市（省略で県内の先頭）") }) },
      (_v, a) => os.tverAreaPlan(a),
    );
    osTool(
      "search_wiki",
      { title: "本部Wikiを検索", description: "OSのWiki記事をキーワードで検索（手順・決まり・事例）。", inputSchema: z.object({ query: z.string(), limit: z.number().int().optional() }) },
      (v, a) => os.searchWiki(v, a),
    );
    osTool(
      "my_summary",
      { title: "自分の数字", description: "商談の状況別件数（月次報告の売上額は本部のみ）。", inputSchema: z.object({ months: z.number().int().optional().describe("何か月分（既定3・最大12）") }) },
      (v, a) => os.mySummary(v, a),
    );
    osTool(
      "list_group_companies",
      { title: "グループ拠点一覧", description: "稼働中の加盟各社（社名・代表・県・得意分野・サイト）。", inputSchema: z.object({}) },
      () => os.listGroupCompanies(),
    );
    osTool(
      "list_leads",
      { title: "リード一覧", description: "グループのリード（見込み先）。mine: true で自分の担当だけ、waitingReply: true で「送付済み・結果未入力」だけ。status: UNTOUCHED / CALLED / APPOINTMENT / DEAL_CONVERTED。結果の記録は record_lead_result。", inputSchema: z.object({ query: z.string().optional(), status: z.string().optional(), mine: z.boolean().optional(), waitingReply: z.boolean().optional(), limit: z.number().int().optional() }) },
      (v, a) => os.listLeads(v, a),
    );
    osTool(
      "list_activities",
      { title: "活動履歴（会話の記録）", description: "顧客または商談の過去のやり取りを新しい順に返す。customerId なら顧客の活動履歴＋その顧客の全商談ログ、dealId なら商談ログだけ。提案や連絡の前に必ず読む。", inputSchema: z.object({ customerId: z.string().optional(), dealId: z.string().optional(), limit: z.number().int().optional().describe("既定30・最大100") }) },
      (v, a) => osw.listActivities(v, a),
    );

    // ---------------- OS 書き込み（営業の記録＝吸い上げ） ----------------
    const osWriteTool = <A extends z.ZodType>(
      name: string,
      cfg: { title: string; description: string; inputSchema: A },
      run: (viewer: os.McpViewer, args: z.infer<A>) => Promise<unknown>,
    ) => {
      const cb = async (args: z.infer<A>, ctx: Ctx) => {
        const w = who(ctx);
        if (!w) return fail("認証されていません");
        if (!w.scopes.includes("os:write")) return fail(NEED_WRITE);
        const viewer = await os.loadViewer(w.email);
        if (!viewer) return fail("このアカウントは利用できません");
        logOs(w, name, args, "mcp_os_write");
        try {
          return json(await run(viewer, args));
        } catch (e) {
          if (e instanceof osw.WriteError) return fail(e.message);
          console.error(`[MCP] ${name} 失敗:`, e);
          return fail("保存に失敗しました。時間をおいて再度お試しください");
        }
      };
      type Reg = Parameters<typeof server.registerTool>;
      server.registerTool(name, { ...cfg, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false } } as unknown as Reg[1], cb as unknown as Reg[2]);
    };

    osWriteTool(
      "log_activity",
      {
        title: "活動を記録（会話の要約を残す）",
        description: "電話・メール・訪問・Web会議・その他のやり取りを、顧客（customerId）または商談（dealId）に1件記録する。会話で営業のやり取りが出たら、相手・要点・次の一手を3〜8行にまとめて残す。type: CALL / EMAIL / VISIT / MEETING / OTHER。occurredAt は YYYY-MM-DD（省略で今日）。",
        inputSchema: z.object({ customerId: z.string().optional(), dealId: z.string().optional(), type: z.string().optional(), content: z.string(), occurredAt: z.string().optional() }),
      },
      (v, a) => osw.logActivity(v, a),
    );
    osWriteTool(
      "create_customer",
      {
        title: "顧客を登録",
        description: "会話に出た新しい取引先・見込み客を貴社の顧客として登録する。登録前に search_customers で重複を確認する。status: PROSPECT / ACTIVE / INACTIVE、rank: A / B / C。金額は入れない。",
        inputSchema: z.object({ name: z.string(), nameKana: z.string().optional(), contactName: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), website: z.string().optional(), industry: z.string().optional(), prefecture: z.string().optional(), address: z.string().optional(), notes: z.string().optional(), status: z.string().optional(), rank: z.string().optional() }),
      },
      (v, a) => osw.createCustomer(v, a),
    );
    osWriteTool(
      "create_deal",
      {
        title: "商談を起こす",
        description: "既存顧客（customerId）に商談を1件作る。status: PROSPECTING / QUALIFYING / PROPOSAL / NEGOTIATION（受注はOS画面で）。probability は 0〜100、expectedCloseDate は YYYY-MM-DD。進行中の商談が既にある顧客は止まるので、別件なら allowDuplicate: true。金額は入れない。",
        inputSchema: z.object({ customerId: z.string(), title: z.string(), status: z.string().optional(), probability: z.number().int().optional(), expectedCloseDate: z.string().optional(), notes: z.string().optional(), allowDuplicate: z.boolean().optional() }),
      },
      (v, a) => osw.createDeal(v, a),
    );
    osWriteTool(
      "update_deal",
      {
        title: "商談を更新（状態・確度・予定日・メモ追記）",
        description: "商談（id）の status / probability / expectedCloseDate を更新し、appendNote でメモを追記する（上書きはしない）。失注は CLOSED_LOST。受注（CLOSED_WON）はOS画面で行う。",
        inputSchema: z.object({ id: z.string(), status: z.string().optional(), probability: z.number().int().optional(), expectedCloseDate: z.string().optional(), appendNote: z.string().optional() }),
      },
      (v, a) => osw.updateDeal(v, a),
    );
    osWriteTool(
      "set_closing_factor",
      {
        title: "受注の決め手を記録",
        description: "受注した（またはほぼ決まった）商談（id）に「何が決め手だったか」を残す。文面・提案内容・関係性・タイミングなど。グループの成功事例学習に使う。",
        inputSchema: z.object({ id: z.string(), closingFactor: z.string() }),
      },
      (v, a) => osw.setClosingFactor(v, a),
    );
    osWriteTool(
      "create_lead",
      {
        title: "OS外で取ったリードを登録",
        description: "紹介・飛び込み・自分で見つけた等、OSを使わずに得た見込み先をリードとして登録する（担当は自分）。同名＋同住所が既にあればそれを返す。status: UNTOUCHED / CALLED / APPOINTMENT。",
        inputSchema: z.object({ name: z.string(), address: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), website: z.string().optional(), industry: z.string().optional(), area: z.string().optional().describe("例: 佐賀県唐津市"), memo: z.string().optional(), status: z.string().optional() }),
      },
      (v, a) => osw.createLead(v, a),
    );
    osWriteTool(
      "record_lead_result",
      {
        title: "リードの結果を記録",
        description: "リード（leadId）の結果をOSに残す。result: REPLIED（返信あり）/ REPLIED_NG（返信NG）/ NO_REPLY（無反応）/ REJECTED（断り）/ WON（受注）＝OS画面の結果ボタンと同じ処理（ステータス移動・グループ事例DBへの反映）。status で APPOINTMENT（アポ獲得）等に直接進められる。note で経緯を残す。会話でリードの結果が分かったら、聞かれなくても記録する。",
        inputSchema: z.object({ leadId: z.string(), result: z.string().optional(), status: z.string().optional(), note: z.string().optional() }),
      },
      (v, a) => osw.recordLeadResult(v, a),
    );
  },
  {
    serverInfo: { name: "adarch-os", version: "1.0.0" },
    instructions:
      "Ad Arch（アドアーチ）グループOSのツール。提案文・資料を作るときは list_materials → get_material/get_full_kit でブランドキットを読んでから書く。数字は取得したものだけを使い「目安・税抜」を添える。価格の正本はOS。" +
      "顧客・商談・見積・リードはグループ全社分が見える（他拠点の金額だけ非表示）。相手先の話をする前に search_customers / list_activities で過去のやり取りを読む。" +
      "【記録の決まり】会話の中で営業のやり取り（電話・メール・訪問・商談の進み具合）や結果（アポ・商談化・受注・失注・断り）が出たら、ユーザーに頼まれなくても log_activity / update_deal / record_lead_result で OS に残す。記録する前に一言「OSに記録します」と伝え、要点を3〜8行にまとめる。新しい相手先は search_customers で重複を確認してから create_customer。金額は書かない。受注の確定はOS画面で行うよう案内する。",
    capabilities: { tools: {} },
    onEvent: (ev) => {
      if (ev.type === "ERROR") console.error("[MCP]", ev.error, ev.context ?? "");
    },
  },
);

const verifyToken = async (_req: Request, bearer?: string): Promise<AuthInfo | undefined> => {
  if (!bearer) return undefined;
  const audience = `${await issuer()}/api/mcp`;
  const c = await verifyAccessToken(bearer, audience);
  if (!c) return undefined;
  return {
    token: bearer,
    clientId: c.clientId,
    scopes: c.scopes,
    expiresAt: c.exp,
    extra: { email: c.email, name: c.name, clientName: c.clientName, grantId: c.grantId },
  };
};

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authed as GET, authed as POST, authed as DELETE };

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version, mcp-session-id",
    },
  });
}
