import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDIO_TOOLS, STUDIO_INSTRUCTIONS, STUDIO_CONSULT_PROMPT, CREATOR_INSTRUCTIONS, CREATOR_CONSULT_PROMPT, publicText, toolsFor } from "../../src/lib/studio/tools";
import { addBusinessMinutes } from "../../src/lib/studio/business-hours";
import { normalizePrefecture } from "../../src/lib/studio/routing";

// 金額の文字列（¥・円・万円・$・料金/価格/見積 など）
const MONEY = /[¥￥]\s*\d|\d[\d,，.]*\s*(円|万円|千円|億円)|\$\s*\d|万円|千円|億円/;

// 公開MCP（ログインなし）はURLごとに、この組み合わせだけを外に出す。増やす・変えるときはここも直す＝意図しない公開を防ぐ
test("企業向け /api/mcp/public のツールは決まった8本だけ", () => {
  assert.deepEqual(
    toolsFor("client").map((t) => t.name).sort(),
    ["find_ad_awards", "find_subsidies", "how_to_proceed", "list_services", "media_specs", "production_guide", "request_order", "tver_area_plan"],
  );
  assert.deepEqual(toolsFor("client").filter((t) => t.write).map((t) => t.name), ["request_order"]);
});

test("制作者向け /api/mcp/public/creator は3本だけ・依頼の受付（request_order）は無い", () => {
  assert.deepEqual(toolsFor("creator").map((t) => t.name).sort(), ["creator_register", "media_specs", "production_guide"]);
  assert.equal(toolsFor("creator").some((t) => t.write || t.name === "request_order"), false);
});

test("制作者向けの説明文は仕事・収入を約束しない（特商法の業務提供誘引販売の訴求を避ける）", () => {
  for (const t of [CREATOR_INSTRUCTIONS, CREATOR_CONSULT_PROMPT({}), ...toolsFor("creator").map((x) => `${x.title} ${x.description}`)]) {
    assert.doesNotMatch(t, /仕事が回|稼げ|稼ぐ|収入になる|儲か|案件が(入|来)/);
    assert.doesNotMatch(t, MONEY);
  }
  assert.match(CREATOR_INSTRUCTIONS, /^あなたのAIに、プロの相談先を。/);
});

test("どちらのURLも同じ実装（共通の台帳）から出す", () => {
  for (const t of [...toolsFor("client"), ...toolsFor("creator")]) assert.ok(STUDIO_TOOLS.includes(t), t.name);
  for (const f of ["src/app/api/mcp/public/route.ts", "src/app/api/mcp/public/creator/route.ts"]) assert.match(readFileSync(f, "utf8"), /studioRoute\("(client|creator)"\)/);
});

test("公開MCPの入口はOSのツール台帳・ブランドキット・OAuth検証を読み込まない", () => {
  const forbidden = /mcp\/tool-catalog|mcp\/os-read-tools|mcp\/os-write-tools|brand-kit\/all-materials|oauth\/server|withMcpAuth|lib\/session|formatPackagePrice|tver-order\/service/;
  for (const f of ["src/app/api/mcp/public/route.ts", "src/app/api/mcp/public/creator/route.ts", "src/lib/studio/mcp-server.ts", "src/lib/studio/tools.ts", "src/lib/studio/guard.ts", "src/lib/studio/routing.ts", "src/lib/studio/lead-link.ts"]) {
    assert.equal(forbidden.test(readFileSync(f, "utf8")), false, f);
  }
});

test("値段を返さない：TVerの目安（県内全部・市ごと）に金額と申込URLが出ない", async () => {
  const tver = STUDIO_TOOLS.find((t) => t.name === "tver_area_plan")!;
  const run = tver.run as (a: unknown, c: unknown) => unknown;
  for (const args of [{ prefecture: "香川県", city: "高松市" }, { prefecture: "香川県", allCities: true }, { prefecture: "東京都", city: "港区" }]) {
    const out = JSON.stringify(await run(args, { ipHash: "t", userAgent: null }));
    assert.doesNotMatch(out, MONEY, JSON.stringify(args));
    assert.doesNotMatch(out, /order\/tver|monthly|applyUrl/i, JSON.stringify(args));
    assert.match(out, /reachPerMonth/i);
  }
});

test("値段を返さない：公開する文章から金額・卸・社内向けの行が落ちる", () => {
  const src = ["採用動画は60秒から。", "導入実績 A社で応募3倍", "制作費は1本 30万円〜", "月額 ¥66,000", "単価 6.6円/再生", "卸値は別資料", "ロイヤリティの扱い", "縦型は9:16・1080×1920", "USD $500", "料金はお問い合わせ"].join("\n");
  const out = publicText(src);
  assert.equal(out, ["採用動画は60秒から。", "縦型は9:16・1080×1920"].join("\n"));
});

test("説明文・プロンプト・ツールの説明に値段と誘導が無い", () => {
  const texts = [STUDIO_INSTRUCTIONS, STUDIO_CONSULT_PROMPT({}), ...STUDIO_TOOLS.map((t) => `${t.title} ${t.description}`)];
  for (const t of texts) assert.doesNotMatch(t, MONEY);
  assert.match(STUDIO_INSTRUCTIONS, /^あなたのAIに、プロの相談先を。/);
  assert.match(STUDIO_INSTRUCTIONS, /価格は伝えません/);
  assert.match(STUDIO_INSTRUCTIONS, /業種と目的/);
  assert.match(STUDIO_INSTRUCTIONS, /自社で作る（内製する）相談も歓迎/);
  assert.match(STUDIO_INSTRUCTIONS, /範囲外として断らない/);
  assert.match(STUDIO_INSTRUCTIONS, /AI自身の一般知識で答えてかまいません/);
  assert.match(STUDIO_INSTRUCTIONS, /SNS運用/);
  assert.match(STUDIO_INSTRUCTIONS, /守秘義務/);
  assert.match(STUDIO_INSTRUCTIONS, /こちらから発注・問い合わせを勧めないでください/);
  assert.match(STUDIO_INSTRUCTIONS, /全国どこでもアドアーチが対応/);
  assert.match(STUDIO_INSTRUCTIONS, /その地域の媒体もアドアーチがお応えします/);
  assert.doesNotMatch(STUDIO_INSTRUCTIONS, /近くの僕ら|全都道府県に拠点があります/);
  assert.match(STUDIO_CONSULT_PROMPT({}), /^あなたのAIに、プロの相談先を。/);
  const order = STUDIO_TOOLS.find((t) => t.name === "request_order")!;
  assert.match(order.description, /相手が自分から/);
  const services = STUDIO_TOOLS.find((t) => t.name === "list_services")!;
  assert.doesNotMatch(services.description, /料金|見積|価格|参考価格/);
});

test("返答期限は平日9〜18時で2時間（金曜17時→月曜10時・土曜→月曜11時）", () => {
  const jst = (s: string) => new Date(`${s}+09:00`);
  const fmt = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" }).format(d);
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-18T10:00:00"))), "2026-09-18 12:00");
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-18T17:00:00"))), "2026-09-21 10:00");
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-19T15:00:00"))), "2026-09-21 11:00");
  assert.equal(fmt(addBusinessMinutes(jst("2026-09-21T07:30:00"))), "2026-09-21 11:00");
});

test("県名をそろえる", () => {
  assert.equal(normalizePrefecture("香川"), "香川県");
  assert.equal(normalizePrefecture("香川県高松市"), "香川県");
  assert.equal(normalizePrefecture("東京都港区"), "東京都");
  assert.equal(normalizePrefecture("北海道札幌市"), "北海道");
  assert.equal(normalizePrefecture("どこか"), null);
});
