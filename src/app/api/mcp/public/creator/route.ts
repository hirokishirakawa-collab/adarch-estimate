// ==============================================================
// Ad Arch Studio — 制作者向けの公開MCP（ログインなし）
//   撮影・編集の技術／媒体の入稿仕様と納品の決まり／クリエイター登録の案内。依頼の受付（request_order）は出さない。
//   ⚠️ 「仕事が回る・稼げる」とは言わない（特商法の業務提供誘引販売の訴求を避ける）
//   仕組みは src/lib/studio/mcp-server.ts（企業向け /api/mcp/public と共通・見せない情報の線も同じ）
// ==============================================================

import { studioRoute } from "@/lib/studio/mcp-server";

export const maxDuration = 30;

const route = studioRoute("creator");
export const { GET, POST, DELETE, OPTIONS } = route;
