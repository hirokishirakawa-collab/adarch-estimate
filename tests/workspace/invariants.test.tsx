import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  NAVIGATION_ITEMS,
  canUseNavigation,
  searchNavigation,
  navigationForPath,
} from "../../src/lib/navigation/catalog";
import { buildAiWorkPrompt } from "../../src/lib/navigation/ai-context";
import { workActions } from "../../src/lib/workspace/next-actions";
import {
  libraryDateRange,
  searchWorkspaceLibrary,
} from "../../src/lib/workspace/library-search";
import { tverOverview } from "../../src/lib/workspace/tver-overview";
import { guidedWikiBody } from "../../src/lib/workspace/wiki-guidance";
import AdminPage from "../../src/app/dashboard/admin/workspace/page";
import type { UserRole } from "../../src/types/roles";

declare global {
  var __testDb: Record<string, Record<string, (...args: any[]) => any>>;
  var __testSession: any;
  var __testViewer: any;
}

test("every existing sidebar destination and old label remains discoverable within its role", () => {
  const original = JSON.parse(
    readFileSync("tests/workspace/navigation-before.json", "utf8"),
  ) as {
    href: string;
    label: string;
    minRole: UserRole;
    requiredFeature?: string;
  }[];
  assert.equal(original.length, 96);
  for (const before of original) {
    const item = NAVIGATION_ITEMS.find((item) => item.href === before.href);
    assert.ok(item, before.href);
    assert.equal(item.minRole, before.minRole);
    assert.equal(item.requiredFeature, before.requiredFeature);
    assert.ok(
      searchNavigation(before.label, "ADMIN").includes(item),
      before.label,
    );
  }
  assert.equal(
    new Set(NAVIGATION_ITEMS.map((item) => item.href)).size,
    NAVIGATION_ITEMS.length,
  );
  for (const item of NAVIGATION_ITEMS)
    for (const alias of item.aliases)
      assert.ok(searchNavigation(alias, "ADMIN").includes(item), alias);
});
test("ADMIN features, franchise feature gates, suspended views and route prefixes do not leak", () => {
  for (const role of ["USER", "MANAGER"] as UserRole[])
    for (const item of NAVIGATION_ITEMS.filter(
      (item) => item.minRole === "ADMIN",
    ))
      assert.equal(canUseNavigation(item, role), false, item.href);
  const gated = NAVIGATION_ITEMS.find((item) => item.requiredFeature)!;
  assert.equal(canUseNavigation(gated, "MANAGER"), false);
  assert.equal(
    canUseNavigation(gated, "MANAGER", [gated.requiredFeature!]),
    true,
  );
  assert.equal(canUseNavigation(gated, "ADMIN"), true);
  for (const item of NAVIGATION_ITEMS)
    assert.equal(
      canUseNavigation(item, "MANAGER", [], true),
      item.href === "/dashboard/sales-report",
    );
  assert.ok(
    searchNavigation("TVer", "MANAGER")
      .slice(0, 8)
      .every((item) => item.label.includes("TVer")),
  );
  assert.equal(
    navigationForPath("/dashboard/tver-campaign/a").item?.href,
    "/dashboard/tver-campaign",
  );
  assert.equal(navigationForPath("/dashboard/customersXYZ").item, undefined);
  assert.equal(
    navigationForPath("/dashboard/admin/workspace").group?.id,
    "admin",
  );
});
test("AI context preserves selected records but strips query tokens and unsafe paths", () => {
  const text = buildAiWorkPrompt({
    label: "確認用顧客",
    task: "提案の続き",
    path: "/dashboard/customers/c-1?token=secret#memo",
  });
  assert.match(text, /customerId: c-1/);
  assert.match(text, /確認用顧客/);
  assert.doesNotMatch(text, /secret|token=|#memo/);
  assert.match(
    buildAiWorkPrompt({ label: "商談", path: "/dashboard/deals/d-1" }),
    /dealId: d-1/,
  );
  assert.doesNotMatch(
    buildAiWorkPrompt({ label: "新規", path: "/dashboard/customers/new" }),
    /customerId:/,
  );
  assert.match(
    buildAiWorkPrompt({
      label: "見込み先",
      path: "/dashboard/leads/list?q=test",
      leadId: "lead-1",
    }),
    /leadId: lead-1/,
  );
  assert.doesNotMatch(
    buildAiWorkPrompt({ label: "画面", path: "https://bad.test" }),
    /bad\.test/,
  );
});
test("next actions deduplicate a deal across urgency buckets before applying the home limit", () => {
  const rows = workActions(
    [
      { no: 0, title: "決め手", items: [{ dealId: "1", customer: "A" }] },
      {
        no: 2,
        title: "期限超過",
        items: [
          { dealId: "1" },
          { dealId: "2", expectedCloseDate: "2026-09-15" },
        ],
      },
      {
        no: 8,
        title: "未送付",
        items: [{ leadId: "1", name: "確認用 & 顧客" }],
      },
    ],
    3,
  );
  assert.deepEqual(
    rows.map((row) => row.key),
    ["deal:1", "deal:2", "lead:1"],
  );
  assert.equal(rows[0].order, 0);
  assert.equal(rows[1].date, "2026-09-15");
  assert.match(rows[2].href, /q=/);
});
test("JST date boundaries are inclusive and invalid dates are ignored", () => {
  const range = libraryDateRange("2026-09-16", "2026-09-16");
  assert.equal(range.gte?.toISOString(), "2026-09-15T15:00:00.000Z");
  assert.equal(range.lte?.toISOString(), "2026-09-16T14:59:59.999Z");
  assert.equal(libraryDateRange("2026-02-30", "invalid").gte, undefined);
});
test("library separates external sources, excludes HQ records for members, and links packages by slug", async () => {
  const seen: any[] = [];
  const date = new Date("2026-09-16T00:00:00Z");
  globalThis.__testDb = {
    knowledgeSource: {
      findMany: async (args) => {
        seen.push(args);
        return [
          {
            id: "k1",
            title: "確認用媒体",
            summary: "仕様",
            origin: "EXTERNAL",
            updatedAt: date,
          },
        ];
      },
    },
    wikiArticle: {
      findMany: async (args) => {
        seen.push(args);
        return [];
      },
    },
    salesPackage: {
      findMany: async (args) => {
        seen.push(args);
        return [
          {
            id: "pk1",
            slug: "test-plan",
            name: "確認用プラン",
            status: "ACTIVE",
            updatedAt: date,
          },
        ];
      },
    },
  };
  Object.assign(globalThis.__testDb, {
    salesApproach: { findMany: async () => [] },
    portfolioItem: { findMany: async () => [] },
    seminarRecording: { findMany: async () => [] },
  });
  const rows = await searchWorkspaceLibrary(
    { role: "USER", email: "preview@example.invalid" },
    { q: "確認用" },
  );
  assert.equal(seen[0].where.hqOnly, false);
  assert.equal(seen[0].where.status, "READY");
  assert.ok(seen[1].where.NOT);
  assert.match(rows.find((row) => row.kind === "material")!.source, /他社/);
  assert.equal(
    rows.find((row) => row.kind === "package")!.href,
    "/dashboard/packages/test-plan",
  );
});
test("TVer keeps both branches and legacy scope on parent and children; pagination is bounded", async () => {
  let query: any;
  globalThis.__testDb = {
    advertiserReview: {
      count: async () => 21,
      findMany: async (args) => {
        query = args;
        return [];
      },
    },
  };
  const result = await tverOverview(
    { role: "MANAGER", branchId: "pref_okinawa", branchId2: "pref_kagawa" },
    { page: "999" },
  );
  assert.equal(result.page, 2);
  assert.equal(query.skip, 20);
  assert.deepEqual(query.where.branchId.in, [
    "pref_okinawa",
    "pref_kagawa",
    "branch_okn",
    "branch_kgo",
  ]);
  assert.deepEqual(
    query.select.tverCampaigns.where.branchId,
    query.where.branchId,
  );
  assert.deepEqual(
    query.select.tverCreativeReviews.where.branchId,
    query.where.branchId,
  );
  await tverOverview({ role: "USER", branchId: null, branchId2: null }, {});
  assert.equal(query.where.branchId, "__unassigned__");
});
test("HQ page rejects non-admin and a stale ADMIN session before any database query", async () => {
  globalThis.__testDb = {};
  globalThis.__testSession = {
    user: { role: "USER", email: "preview@example.invalid" },
  };
  await assert.rejects(AdminPage(), /REDIRECT:\/dashboard/);
  globalThis.__testSession.user.role = "ADMIN";
  globalThis.__testViewer = { role: "MANAGER" };
  await assert.rejects(AdminPage(), /REDIRECT:\/dashboard/);
});
test("old wiki guidance precedes historic instructions; unrelated articles remain unchanged", () => {
  const body = "古い説明。受注ならOS画面で行います。";
  assert.ok(guidedWikiBody("営業", body).startsWith("【現行手順の注記】"));
  assert.equal(guidedWikiBody("写真の撮り方", "通常の記事"), "通常の記事");
  assert.match(guidedWikiBody("自動営業モニター", "旧機能"), /廃止/);
});
test("all new entry points exist", () => {
  for (const path of [
    "ai",
    "activity",
    "updates",
    "library",
    "guide",
    "procedures",
    "next-actions",
    "tver",
    "admin/workspace",
    "work/[group]",
  ])
    assert.ok(existsSync(`src/app/dashboard/${path}/page.tsx`), path);
});
