import test from "node:test";
import assert from "node:assert/strict";
import { NAVIGATION_ITEMS, canUseNavigation, type NavigationItem } from "../../src/lib/navigation/catalog";
import { TASK_HUBS, toolsForItems, searchTools, type TaskGroup } from "../../src/lib/workspace/task-catalog";
import type { UserRole } from "../../src/types/roles";

const groups = Object.keys(TASK_HUBS) as TaskGroup[];

test("every permitted destination appears exactly once with a task and description in all four hubs", () => {
  for (const group of groups) {
    for (const role of ["USER", "MANAGER", "ADMIN"] as UserRole[]) {
      const items = NAVIGATION_ITEMS.filter((item) => item.group === group && canUseNavigation(item, role));
      const tools = toolsForItems(group, items);
      const expected = items.filter((item) => item.href !== `/dashboard/work/${group}`).map((item) => item.href).sort();
      assert.deepEqual(tools.map((tool) => tool.item.href).sort(), expected);
      for (const tool of tools) {
        assert.ok(TASK_HUBS[group].tools[tool.item.href], tool.item.href);
        assert.ok(TASK_HUBS[group].tasks.some((task) => task.id === tool.task));
        assert.ok(tool.title && tool.description);
        assert.equal(tool.item, items.find((item) => item.href === tool.item.href));
      }
    }
  }
});

test("ungranted tools stay out of cards and search, including franchise gates and project operations", () => {
  const forRole = (group: TaskGroup, role: UserRole, features: string[] = []) => toolsForItems(group, NAVIGATION_ITEMS.filter((item) => canUseNavigation(item, role, features)));
  const user = forRole("sales", "USER");
  assert.equal(user.some((tool) => tool.item.href === "/dashboard/outreach-pipeline"), false);
  assert.equal(user.some((tool) => tool.item.href === "/dashboard/auto-sales/history"), false);
  assert.equal(searchTools(user, "加盟").length, 0);
  assert.equal(searchTools(forRole("sales", "MANAGER", ["franchise-leads"]), "加盟").length, 1);
  assert.equal(searchTools(forRole("sales", "ADMIN"), "加盟").length, 1);
  assert.equal(forRole("projects", "USER").some((tool) => tool.task === "operate"), false);
  assert.ok(forRole("projects", "MANAGER").some((tool) => tool.item.href === "/dashboard/meta-ads"));
  const suspended = NAVIGATION_ITEMS.filter((item) => canUseNavigation(item, "MANAGER", [], true));
  for (const group of groups) {
    assert.deepEqual(toolsForItems(group, []), []);
    assert.deepEqual(toolsForItems(group, suspended).map((tool) => tool.item.href), group === "procedures" ? ["/dashboard/sales-report"] : []);
  }
});

test("existing labels and aliases remain searchable with full-width and multiple-word queries", () => {
  for (const group of groups) {
    const tools = toolsForItems(group, NAVIGATION_ITEMS);
    for (const tool of tools) {
      for (const query of [tool.item.label, ...tool.item.aliases]) {
        assert.ok(searchTools(tools, query).some((found) => found.item.href === tool.item.href), query);
      }
    }
    assert.deepEqual(searchTools(tools, "見つからない確認文字列"), []);
  }
  assert.equal(searchTools(toolsForItems("sales", NAVIGATION_ITEMS), "ＴＶｅｒ　相談")[0]?.item.href, "/dashboard/tver-order-link");
  assert.equal(searchTools(toolsForItems("projects", NAVIGATION_ITEMS), "ＴＶｅｒ　素材")[0]?.item.href, "/dashboard/tver-creative-review");
  assert.equal(searchTools(toolsForItems("library", NAVIGATION_ITEMS), "ブランドキット")[0]?.item.href, "/dashboard/brand-kit");
});

test("future authorized items and external destinations remain reachable without crossing group boundaries", () => {
  for (const group of groups) {
    const extra: NavigationItem = { href: `/dashboard/future-${group}`, label: "将来の機能", group, section: "追加", aliases: ["未来の機能"], minRole: "USER" };
    const tools = toolsForItems(group, [extra, extra, { ...extra, href: "/dashboard/admin/test", group: "admin" }]);
    assert.equal(tools.length, 1);
    assert.equal(searchTools(tools, "未来")[0].item.href, extra.href);
  }
  const drive = toolsForItems("library", NAVIGATION_ITEMS).filter((tool) => tool.item.external);
  assert.equal(drive.length, 1);
  assert.equal(drive[0].item.href, NAVIGATION_ITEMS.find((item) => item.group === "library" && item.external)?.href);
});

test("procedures preserve the three directions, member-only entries and both external destinations", () => {
  const all = toolsForItems("procedures", NAVIGATION_ITEMS);
  const byTask = (id: string) => all.filter((tool) => tool.task === id).map((tool) => tool.item.href);
  assert.deepEqual(byTask("client-billing"), ["/dashboard/billing"]);
  assert.deepEqual(byTask("from-hq"), ["/dashboard/partner-status", "/dashboard/payments", "/dashboard/royalty"]);
  assert.deepEqual(byTask("to-hq"), ["/dashboard/sales-report", "/dashboard/billing/settings", "/dashboard/procedures"]);
  const user = toolsForItems("procedures", NAVIGATION_ITEMS.filter((item) => canUseNavigation(item, "USER")));
  for (const restricted of ["/dashboard/sales-report", "/dashboard/royalty", "/dashboard/payments", "/dashboard/billing/settings", "/dashboard/violation-report"]) {
    assert.equal(user.some((tool) => tool.item.href === restricted), false);
  }
  assert.deepEqual(all.filter((tool) => tool.item.external).map((tool) => tool.item.href).sort(), NAVIGATION_ITEMS.filter((item) => item.group === "procedures" && item.external).map((item) => item.href).sort());
});
