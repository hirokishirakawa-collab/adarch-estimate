// ==============================================================
// Ad Arch Studio — 公開MCP（ログインなし・誰でもつなげる「相談窓口」・依頼も受けられる・全国対応）
//   企業・クリエイター・（将来）海外代理店が自分の Claude / ChatGPT に https://<OS>/api/mcp/public を追加して使う。
//   ツールは src/lib/studio/tools.ts の7本だけ（相談の材料・サービス・TVer・補助金・広告賞・発注）＋プロンプト consult（相談の型・依頼へ誘導しない）。OSのツール台帳・ブランドキットはここから読み込まない
//   （＝トークンの有無にかかわらず、OSの顧客・商談・売上に届く経路がコード上に無い）。
//   Authorization ヘッダーは見ない（OSのトークンを付けてきても公開の動きしかしない）。
//   守り: IPごと・全体の上限（lib/studio/guard.ts）／問い合わせはメール単位・全体をDBで数える／呼び出しは監査ログ mcp_public
// ==============================================================

import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/contact/guard";
import { infoLimited, ipHash } from "@/lib/studio/guard";
import { z } from "zod";
import { STUDIO_CONSULT_PROMPT, STUDIO_INSTRUCTIONS, STUDIO_TOOLS, type StudioCaller } from "@/lib/studio/tools";

export const maxDuration = 30;

type Ctx = { http?: { authInfo?: AuthInfo } };

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 1) }] });
const fail = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });

function caller(ctx: Ctx): StudioCaller {
  const extra = (ctx.http?.authInfo?.extra ?? {}) as Partial<StudioCaller>;
  return { ipHash: extra.ipHash ?? "unknown", userAgent: extra.userAgent ?? null };
}

const handler = createMcpHandler(
  (server) => {
    type Reg = Parameters<typeof server.registerTool>;
    for (const t of STUDIO_TOOLS) {
      const cb = async (args: Record<string, unknown>, ctx: Ctx) => {
        const c = caller(ctx);
        if (!t.write) {
          const limited = infoLimited(c.ipHash);
          if (limited) return fail(limited);
        }
        // 問い合わせは本文を監査ログに残さない（個人情報）。種類だけ
        const logged = t.write ? { kind: args.kind } : args;
        void logAudit({
          action: "mcp_public",
          email: "public",
          entity: "studio_tool",
          entityId: t.name,
          detail: `[${(c.userAgent ?? "AI").slice(0, 60)}] ${c.ipHash.slice(0, 8)} ${JSON.stringify(logged ?? {})}`.slice(0, 1000),
        });
        try {
          const out = await (t.run as (a: unknown, c: StudioCaller) => unknown)(args, c);
          return json(out);
        } catch (e) {
          console.error(`[studio-mcp] ${t.name} 失敗:`, e);
          return fail("ただいま処理できませんでした。時間をおいて再度お試しください。");
        }
      };
      const cfg = {
        title: t.title,
        description: t.description,
        inputSchema: t.input,
        annotations: t.write ? { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } : { readOnlyHint: true, openWorldHint: false },
      };
      server.registerTool(t.name, cfg as unknown as Reg[1], cb as unknown as Reg[2]);
    }

    // 相談のプロンプト（Claude側でスラッシュ一発）。依頼へ誘導しない＝相手が頼みたいと言うまで発注・料金の話はしない
    type P = Parameters<typeof server.registerPrompt>;
    server.registerPrompt(
      "consult",
      { title: "動画制作・撮影・SNS・広告媒体の相談", description: "アドアーチの相談窓口に、制作や広告媒体の使い方を相談する", argsSchema: z.object({ topic: z.string().optional().describe("相談したいこと（任意）") }) } as unknown as P[1],
      ((a: { topic?: string }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: STUDIO_CONSULT_PROMPT(a ?? {}) } }] })) as unknown as P[2],
    );
  },
  {
    serverInfo: { name: "adarch-studio", version: "1.0.0" },
    instructions: STUDIO_INSTRUCTIONS,
    capabilities: { tools: {}, prompts: {} },
    onEvent: (ev) => {
      if (ev.type === "ERROR") console.error("[studio-mcp]", ev.error, ev.context ?? "");
    },
  },
);

/** 呼び出し元（IPのハッシュとUA）をツールへ渡す。Bearer は読まない */
async function withCaller(req: Request): Promise<Response> {
  const auth: AuthInfo = {
    token: "",
    clientId: "public",
    scopes: [],
    extra: { ipHash: ipHash(clientIp(req.headers)), userAgent: req.headers.get("user-agent") },
  };
  (req as Request & { auth?: AuthInfo }).auth = auth;
  return handler(req);
}

export { withCaller as GET, withCaller as POST, withCaller as DELETE };

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, mcp-protocol-version, mcp-session-id",
    },
  });
}
