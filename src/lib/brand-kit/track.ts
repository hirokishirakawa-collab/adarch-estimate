import { logAudit } from "@/lib/audit";

export type BrandKitEvent = "download" | "copy" | "mcp";

/** 記録の「種類」（entityId に入る）。管理画面の監査ログで絞り込む目印 */
export type BrandKitKind =
  | "material" // 材料1件の .md（個別API・共通の決まりmd）
  | "combined" // 設定文＋材料を1本の .md
  | "zip" // ZIPで個別に
  | "copy_one" // 材料1件をコピー
  | "copy_all" // AIをアドアーチ仕様にする（全文コピー）
  | "mcp_list" // MCP: 材料一覧
  | "mcp_one" // MCP: 材料1件
  | "mcp_all"; // MCP: 束ね（設定文＋材料）

interface TrackInput {
  event: BrandKitEvent;
  kind: BrandKitKind;
  /** 材料のラベル（複数可）。監査ログの detail に入る */
  items: string[];
  email: string;
  name?: string | null;
  req?: Request;
  /** MCP経由のとき: 接続しているAIクライアント名（Claude / ChatGPT など） */
  clientName?: string | null;
}

/**
 * ブランドキット（AI用材料）の持ち出しを監査ログに残す。
 * action = brand_kit_download / brand_kit_copy / brand_kit_mcp、entity = brand_kit、entityId = 種類、detail = 材料名。
 * MCP（AIが直接引く）のときは detail の先頭に AIクライアント名を入れる。
 * 加盟店には見せない（ADMIN の監査ログ画面でのみ確認）。失敗しても本体処理は止めない。
 */
export function trackBrandKit(input: TrackInput): void {
  const items = input.items.map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const via = input.event === "mcp" ? `[${input.clientName ?? "AI"}] ` : "";
  const detail = `${via}${items.length}件: ${items.join("／")}`.slice(0, 1000);
  void logAudit({
    action: input.event === "copy" ? "brand_kit_copy" : input.event === "mcp" ? "brand_kit_mcp" : "brand_kit_download",
    email: input.email,
    name: input.name ?? null,
    entity: "brand_kit",
    entityId: input.kind,
    detail,
    ipAddress: input.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: input.req?.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
}
