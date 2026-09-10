// ==============================================================
// MCP エンドポイント（Streamable HTTP・ステートレス）
//   各代表の Claude / ChatGPT が「カスタムコネクタ」でここに繋ぐ。
//   認証 = OS内蔵OAuthのアクセストークン（Bearer）。呼び出しは全部 監査ログへ。
//   scope brand_kit : ブランドキット（材料一覧・1件・束ね）
//   scope os:read   : 全社の顧客・商談・見積・リード・活動履歴（他拠点の金額は非表示）・パッケージ台帳・TVerプラン・Wiki・
//                     自分の数字・拠点一覧・似た案件の勝ち筋(find_similar_wins)・提案書の材料束(draft_proposal)
//   scope os:write  : 営業の記録（活動・顧客/商談/リードの登録・商談更新・決め手・リードの結果）＝各拠点のデータの吸い上げ
//
//   2026-09-09 第2段:
//   ・ツール定義は src/lib/mcp/tool-catalog.ts に一本化（OS内のアーチくんと共用）
//   ・Prompts: /proposal /after_meeting /morning（Claude側でスラッシュ一発）
//   ・ChatGPT Apps SDK: 商談カード・今日の一手のウィジェット資源（ui://…）＋ outputTemplate
//   ・書き込み前の確認（Elicitation）: 2026-07-28 仕様の多段往復（inputRequired）に対応したクライアントにだけ出す。
//     非対応（Claude.ai / ChatGPT の現行コネクタ・2025年仕様）は従来通りそのまま書く
//   ・書き込みのレート上限（1人あたり 20回/分・300回/日）
// ==============================================================

import type { AuthInfo, ClientCapabilities } from "@modelcontextprotocol/server";
import { acceptedContent, inputRequired, inputResponse } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { buildAllMaterials, combineMaterials } from "@/lib/brand-kit/all-materials";
import { trackBrandKit } from "@/lib/brand-kit/track";
import { issuer, verifyAccessToken, type Scope } from "@/lib/oauth/server";
import * as os from "@/lib/mcp/os-read-tools";
import * as osw from "@/lib/mcp/os-write-tools";
import { OS_AI_RULES, OS_TOOLS, UI_DEAL_CARD, UI_NEXT_ACTIONS, type OsToolDef } from "@/lib/mcp/tool-catalog";
import { DEAL_CARD_HTML, NEXT_ACTIONS_HTML } from "@/lib/mcp/widgets";

export const maxDuration = 120; // discover_leads（検索→採点→保存）が長い

type Ctx = {
  http?: { authInfo?: AuthInfo };
  mcpReq?: { envelope?: unknown; inputResponses?: Record<string, unknown> };
};

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
const json = (v: unknown, structured?: boolean) => ({
  content: [{ type: "text" as const, text: JSON.stringify(v, null, 1) }],
  ...(structured && v && typeof v === "object" && !Array.isArray(v) ? { structuredContent: v as Record<string, unknown> } : {}),
});
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

// ---- 書き込みのレート上限（プロセス内・1人あたり） ----------------------------------
const WRITE_PER_MINUTE = 20;
const WRITE_PER_DAY = 300;
const writeMinute = new Map<string, { n: number; until: number }>();
const writeDay = new Map<string, { n: number; until: number }>();
function bump(store: Map<string, { n: number; until: number }>, key: string, windowMs: number): number {
  const now = Date.now();
  const e = store.get(key);
  if (!e || e.until < now) {
    store.set(key, { n: 1, until: now + windowMs });
    return 1;
  }
  e.n += 1;
  return e.n;
}
function writeAllowed(email: string): string | null {
  if (bump(writeMinute, email, 60_000) > WRITE_PER_MINUTE) return `書き込みが多すぎます（1分に${WRITE_PER_MINUTE}回まで）。少し待ってからお試しください`;
  if (bump(writeDay, email, 24 * 3_600_000) > WRITE_PER_DAY) return `本日の書き込み上限（${WRITE_PER_DAY}回）に達しました。明日以降にお試しください`;
  return null;
}

// ---- 書き込み前の確認（対応クライアントだけ） ------------------------------------------
/** 2026-07-28 仕様（リクエスト封筒あり）で、フォーム型の Elicitation を名乗るクライアントか */
function canConfirm(ctx: Ctx, caps: ClientCapabilities | undefined): boolean {
  if (!ctx.mcpReq || ctx.mcpReq.envelope === undefined) return false; // 2025年仕様＝ステートレスでは往復できない
  const el = caps?.elicitation as { form?: unknown } | undefined;
  return !!el && (el.form !== undefined || Object.keys(el).length === 0);
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

    // ---------------- OS 読み取り／書き込み（台帳から一括登録） ----------------
    // 共通の前処理（認証→scope→利用者→監査ログ→（書き込みは上限・確認）→実行）を1か所に。
    // 型はSDKの多重定義に合わせて呼び出し側でキャスト
    type Reg = Parameters<typeof server.registerTool>;
    const register = (t: OsToolDef) => {
      const isWrite = t.kind === "write";
      const cb = async (args: Record<string, unknown>, ctx: Ctx) => {
        const w = who(ctx);
        if (!w) return fail("認証されていません");
        if (isWrite && !w.scopes.includes("os:write")) return fail(NEED_WRITE);
        if (!isWrite && !w.scopes.includes("os:read")) return fail(NEED_OS);
        const viewer = await os.loadViewer(w.email);
        if (!viewer) return fail("このアカウントは利用できません");

        if (isWrite) {
          const limited = writeAllowed(w.email);
          if (limited) return fail(limited);
          // 対応クライアントには書き込み前に確認を出す（多段往復）。返答が無ければ確認を要求し、断られたら書かない
          if (t.confirm && canConfirm(ctx, server.server.getClientCapabilities())) {
            const view = inputResponse(ctx.mcpReq?.inputResponses, "confirm");
            if (view.kind === "missing") {
              return inputRequired({
                inputRequests: {
                  confirm: inputRequired.elicit({
                    message: `${t.confirm(args)}\n\nOSに書き込んでよいですか？`,
                    requestedSchema: { type: "object", properties: { ok: { type: "boolean", title: "書き込む", description: "はい＝OSに記録する" } }, required: ["ok"] },
                  }),
                },
              });
            }
            const ok = view.kind === "elicit" && view.action === "accept" && acceptedContent<{ ok?: boolean }>(ctx.mcpReq?.inputResponses, "confirm")?.ok === true;
            if (!ok) return text("書き込みを取りやめました（確認で「いいえ」が選ばれました）");
          }
        }

        logOs(w, t.name, args, isWrite ? "mcp_os_write" : "mcp_os_read");
        try {
          const out = await t.run(viewer, args);
          if (out == null) return fail("見つかりませんでした（貴社の拠点の範囲外か、存在しないIDです）");
          return json(out, !!t.uiTemplate);
        } catch (e) {
          if (e instanceof osw.WriteError) return fail(e.message);
          console.error(`[MCP] ${t.name} 失敗:`, e);
          return fail(isWrite ? "保存に失敗しました。時間をおいて再度お試しください" : "取得に失敗しました。時間をおいて再度お試しください");
        }
      };
      const cfg = {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: isWrite ? { readOnlyHint: false, destructiveHint: false, idempotentHint: false } : { readOnlyHint: true },
        ...(t.uiTemplate
          ? { _meta: { "openai/outputTemplate": t.uiTemplate, "openai/toolInvocation/invoking": "Ad Arch OS を確認中…", "openai/toolInvocation/invoked": "Ad Arch OS から取得しました", "openai/widgetAccessible": false } }
          : {}),
      };
      server.registerTool(t.name, cfg as unknown as Reg[1], cb as unknown as Reg[2]);
    };
    OS_TOOLS.forEach(register);

    // ---------------- ウィジェット資源（ChatGPT Apps SDK） ----------------
    const widget = (name: string, uri: string, title: string, html: string) =>
      server.registerResource(
        name,
        uri,
        { title, description: `${title}（ChatGPT のチャット内に描くカード）`, mimeType: "text/html+skybridge", _meta: { "openai/widgetPrefersBorder": true, "openai/widgetDescription": title } },
        async () => ({ contents: [{ uri, mimeType: "text/html+skybridge", text: html }] }),
      );
    widget("deal-card", UI_DEAL_CARD, "商談カード", DEAL_CARD_HTML);
    widget("next-actions", UI_NEXT_ACTIONS, "今日の一手", NEXT_ACTIONS_HTML);

    // ---------------- Prompts（Claude側でスラッシュ一発） ----------------
    const prompt = (name: string, title: string, description: string, args: Record<string, z.ZodString | z.ZodOptional<z.ZodString>>, build: (a: Record<string, string | undefined>) => string) => {
      type P = Parameters<typeof server.registerPrompt>;
      server.registerPrompt(
        name,
        { title, description, argsSchema: z.object(args) } as unknown as P[1],
        ((a: Record<string, string | undefined>) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: build(a ?? {}) } }] })) as unknown as P[2],
      );
    };
    prompt(
      "proposal", "提案文・提案資料を書く", "顧客名（とパッケージ）を渡すと、OSの材料を束ねて提案文を書く",
      { customer: z.string().describe("顧客名（OSに登録済み）"), package: z.string().optional().describe("パッケージ名や slug（任意）"), format: z.string().optional().describe("メール / A4一枚 / スライド のどれか（既定: メール）") },
      (a) =>
        `「${a.customer}」向けの提案${a.format ? `（${a.format}）` : "（メール文）"}を作ってください。手順: 1) search_customers で「${a.customer}」の id を確認 2) ${a.package ? `list_packages で「${a.package}」の slug を確認し、` : ""}draft_proposal(customerId${a.package ? ", packageSlug" : ""}) を1回呼ぶ 3) 返った writingGuide の順に書く。数字には「目安・税抜」を添え、金額の正本はOSと明記。最後に、提案を送ったら log_activity で記録する旨を一言添える。`,
    );
    prompt(
      "after_meeting", "面談後の記録（OSに残す）", "面談・電話・訪問の内容を貼ると、要点を3〜8行にまとめてOSに記録する",
      { customer: z.string().describe("相手先の名前"), notes: z.string().describe("面談メモ（箇条書きや走り書きでよい）") },
      (a) =>
        `「${a.customer}」との面談の記録をOSに残してください。メモ:\n${a.notes}\n\n手順: 1) search_customers → 無ければ create_customer 2) 進行中の商談があれば list_deals(customerId) で確認 3) 要点（相手・出た話・懸念・次の一手・期日）を3〜8行にまとめ「OSに記録します」と一言添えてから log_activity 4) 状態・確度・見込み日が動いたら update_deal 5) 受注が決まっていたら set_closing_factor で決め手も残す（受注の確定はOS画面で）。金額は書かない。`,
    );
    prompt(
      "weekly", "週次を出す（本部への週次共有）", "この1週間のOSの記録から週次共有の下書きを作り、確認してから提出する",
      { extra: z.string().optional().describe("OSに残っていない今週の動き（任意・箇条書きでよい）") },
      (a) =>
        `本部への週次共有を出してください。手順: 1) my_week を1回呼ぶ 2) 返った記録${a.extra ? `と、次の補足「${a.extra}」` : ""}だけから Q2（先週やったこと＝声をかけた先・返事・動いた商談・活動記録を3〜6行）と Q3（来週やること＝先週の予定の続き・受注候補への次の一手）と Q4（共有・相談。なければ「特になし」）を下書きし、Q1（いい感じ / ちょっと苦戦中 / 手が止まっている）と Q5（今は大丈夫 / あると助かる / できれば早めに欲しい）は私に選ばせてください 3) 下書きを見せて直しを受ける 4) 確認が取れたら submit_weekly_share で提出。数字と相手先名は記録にあるものだけ。金額は書かない。`,
    );
    prompt(
      "morning", "朝の一手", "今日やることを 1→6 の順で 3〜8 行に",
      {},
      () => "my_next_actions を呼び、返った sections を 1→6 の順に、3〜8行で「今日の一手」として提案してください。各行は「相手先 → 何をするか」の形。1〜3 は今日中に動くもの、4〜6 は声をかける候補。金額は書かない。",
    );
  },
  {
    serverInfo: { name: "adarch-os", version: "1.2.0" },
    instructions:
      "Ad Arch（アドアーチ）グループOSのツール。提案文・資料を作るときは list_materials → get_material/get_full_kit でブランドキットを読んでから書く。数字は取得したものだけを使い「目安・税抜」を添える。価格の正本はOS。" +
      OS_AI_RULES,
    capabilities: { tools: {}, resources: {}, prompts: {} },
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
