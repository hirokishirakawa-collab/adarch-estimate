import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDIO_TOOLS, STUDIO_INSTRUCTIONS } from "../../src/lib/studio/tools";
import { addBusinessMinutes } from "../../src/lib/studio/business-hours";
import { normalizePrefecture } from "../../src/lib/studio/routing";

// 公開MCP（ログインなし）は、この7本だけを外に出す。増やす・変えるときはここも直す＝意図しない公開を防ぐ
test("公開MCPのツールは決まった7本だけ", () => {
  assert.deepEqual(
    STUDIO_TOOLS.map((t) => t.name).sort(),
    ["consult_guides", "find_ad_awards", "find_subsidies", "get_guide", "list_services", "request_order", "tver_area_plan"],
  );
  assert.deepEqual(STUDIO_TOOLS.filter((t) => t.write).map((t) => t.name), ["request_order"]);
});

test("公開MCPの入口はOSのツール台帳・ブランドキット・OAuth検証を読み込まない", () => {
  const forbidden = /mcp\/tool-catalog|mcp\/os-read-tools|mcp\/os-write-tools|brand-kit\/all-materials|oauth\/server|withMcpAuth|lib\/session/;
  for (const f of ["src/app/api/mcp/public/route.ts", "src/lib/studio/tools.ts", "src/lib/studio/guard.ts", "src/lib/studio/routing.ts"]) {
    assert.equal(forbidden.test(readFileSync(f, "utf8")), false, f);
  }
});

test("相談が主役：説明文は依頼へ誘導しない・社名や拠点数を断言しない", () => {
  assert.match(STUDIO_INSTRUCTIONS, /こちらから発注・問い合わせ・料金を勧めないでください/);
  assert.match(STUDIO_INSTRUCTIONS, /全国/);
  assert.doesNotMatch(STUDIO_INSTRUCTIONS, /全都道府県に拠点があります/);
  const order = STUDIO_TOOLS.find((t) => t.name === "request_order")!;
  assert.match(order.description, /相手が自分から/);
});

test("返答期限は平日9〜18時で2時間（金曜17時→月曜10時・土曜→月曜11時）", () => {
  const jst = (s: string) => new Date(`${s}+09:00`);
  const fmt = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" }).format(d);
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-18T10:00:00"))), "2026-09-18 12:00"); // 金 10:00
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-18T17:00:00"))), "2026-09-21 10:00"); // 金 17:00 → 月 10:00
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-19T15:00:00"))), "2026-09-21 11:00"); // 土 → 月 11:00
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-21T07:30:00"))), "2026-09-21 11:00"); // 月 始業前
});

test("県名をそろえる", () => {
  assert.equal(normalizePrefecture("香川"), "香川県");
  assert.equal(normalizePrefecture("香川県高松市"), "香川県");
  assert.equal(normalizePrefecture("東京都港区"), "東京都");
  assert.equal(normalizePrefecture("北海道札幌市"), "北海道");
  assert.equal(normalizePrefecture("どこか"), null);
});
