// ==============================================================
// Ad Arch Studio — 公開MCPの共通の入口（ログインなし）
//   企業向け /api/mcp/public と 制作者向け /api/mcp/public/creator は、ここで作る同じ仕組み。
//   違うのは「登録するツールの組み合わせ」と「説明文・プロンプト」だけ（見せない情報の線は同じ）。
//   Authorization ヘッダーは読まない（OSのトークンを付けてきても公開の動きしかしない）。
//   ⚠️ OSのツール台帳・ブランドキット・OAuth検証はここから読み込まない
//   守り: IPごと・全体の上限（guard.ts）／依頼はメール単位・全体をDBで数える
//   監査ログ: action=mcp_public・entity=studio_client／studio_creator（どちらのURLから来たか）
// ==============================================================

import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/contact/guard";
import { infoLimited, ipHash } from "./guard";
import { STUDIO_ORIGIN, isStudioHost } from "./host";
import { studioTermsUrl } from "./terms";
import {
  CREATOR_CONSULT_PROMPT,
  CREATOR_INSTRUCTIONS,
  STUDIO_CONSULT_PROMPT,
  studioInstructions,
  toolsFor,
  type StudioAudience,
  type StudioCaller,
} from "./tools";

type Ctx = { http?: { authInfo?: AuthInfo } };

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 1) }] });
const fail = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });

function caller(ctx: Ctx): StudioCaller {
  const extra = (ctx.http?.authInfo?.extra ?? {}) as Partial<StudioCaller>;
  return { ipHash: extra.ipHash ?? "unknown", userAgent: extra.userAgent ?? null, termsUrl: extra.termsUrl ?? studioTermsUrl() };
}

function buildHandler(audience: StudioAudience, termsUrl: string) {
  const tools = toolsFor(audience);
  const entity = audience === "creator" ? "studio_creator" : "studio_client";
  return createMcpHandler(
    (server) => {
      type Reg = Parameters<typeof server.registerTool>;
      for (const t of tools) {
        const cb = async (args: Record<string, unknown>, ctx: Ctx) => {
          const c = caller(ctx);
          if (!t.write) {
            const limited = infoLimited(c.ipHash);
            if (limited) return fail(limited);
          }
          // 依頼は本文を監査ログに残さない（個人情報）。種類だけ
          const logged = t.write ? { kind: args.kind } : args;
          void logAudit({
            action: "mcp_public",
            email: "public",
            entity,
            entityId: t.name,
            detail: `[${audience}] [${(c.userAgent ?? "AI").slice(0, 60)}] ${c.ipHash.slice(0, 8)} ${JSON.stringify(logged ?? {})}`.slice(0, 1000),
          });
          try {
            const out = await (t.run as (a: unknown, c: StudioCaller) => unknown)(args, c);
            return json(out);
          } catch (e) {
            console.error(`[studio-mcp:${audience}] ${t.name} 失敗:`, e);
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

      // 相談のプロンプト（Claude側でスラッシュ一発）。依頼へ誘導しない
      type P = Parameters<typeof server.registerPrompt>;
      const build = audience === "creator" ? CREATOR_CONSULT_PROMPT : STUDIO_CONSULT_PROMPT;
      server.registerPrompt(
        "consult",
        {
          title: "あなたのAIに、プロの相談先を",
          description: audience === "creator" ? "撮影・編集の技術と、媒体の入稿仕様・納品の決まりを相談する" : "動画制作・撮影・SNS運用・広告媒体の技術を、アドアーチの窓口に相談する（業種と目的から理想の進め方を）",
          argsSchema: z.object({ topic: z.string().optional().describe("相談したいこと（任意）") }),
        } as unknown as P[1],
        ((a: { topic?: string }) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: build(a ?? {}) } }] })) as unknown as P[2],
      );
    },
    {
      serverInfo: { name: audience === "creator" ? "adarch-studio-creator" : "adarch-studio", version: "1.1.0" },
      instructions: audience === "creator" ? CREATOR_INSTRUCTIONS : studioInstructions(termsUrl),
      capabilities: { tools: {}, prompts: {} },
      onEvent: (ev) => {
        if (ev.type === "ERROR") console.error(`[studio-mcp:${audience}]`, ev.error, ev.context ?? "");
      },
    },
  );
}

/** URLごとの route の中身（GET/POST/DELETE/OPTIONS） */
export function studioRoute(audience: StudioAudience) {
  // 入口のドメインごとに説明文（利用条件のURL）が違うので、ハンドラーを2つ持つ（作るのは最初の呼び出し時）
  const handlers = new Map<"os" | "studio", ReturnType<typeof buildHandler>>();
  const handlerFor = (studio: boolean) => {
    const key = studio ? "studio" : "os";
    let h = handlers.get(key);
    if (!h) handlers.set(key, (h = buildHandler(audience, studio ? `${STUDIO_ORIGIN}/terms` : studioTermsUrl())));
    return h;
  };
  /** 呼び出し元（IPのハッシュとUA）をツールへ渡す。Bearer は読まない */
  const withCaller = async (req: Request): Promise<Response> => {
    // studio.adarch.co.jp から来たときは利用条件のURLも studio ドメインで返す（Host だけで判定＝rewrites と同じ条件）
    const studio = isStudioHost(req.headers.get("host"));
    const auth: AuthInfo = {
      token: "",
      clientId: `public-${audience}`,
      scopes: [],
      extra: { ipHash: ipHash(clientIp(req.headers)), userAgent: req.headers.get("user-agent"), termsUrl: studio ? `${STUDIO_ORIGIN}/terms` : studioTermsUrl() },
    };
    (req as Request & { auth?: AuthInfo }).auth = auth;
    return handlerFor(studio)(req);
  };
  const OPTIONS = () =>
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, mcp-protocol-version, mcp-session-id",
      },
    });
  return { GET: withCaller, POST: withCaller, DELETE: withCaller, OPTIONS };
}
