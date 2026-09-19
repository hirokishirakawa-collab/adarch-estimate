// ==============================================================
// Ad Arch Studio — 企業向けの公開MCP（ログインなし）「あなたのAIに、プロの相談先を」
//   企業が自分の Claude / ChatGPT に https://<OS>/api/mcp/public を追加して使う。
//   進め方の手本・制作/SNS運用の技術・媒体仕様・TVerの目安・サービス・補助金・広告賞・依頼の受付（request_order）。
//   値段と実績は返さない。仕組みは src/lib/studio/mcp-server.ts（制作者向け /api/mcp/public/creator と共通）
// ==============================================================

import { studioRoute } from "@/lib/studio/mcp-server";

export const maxDuration = 30;

const route = studioRoute("client");
export const { GET, POST, DELETE, OPTIONS } = route;
