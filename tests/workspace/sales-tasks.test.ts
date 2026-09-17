import test from "node:test";
import assert from "node:assert/strict";
import { NAVIGATION_ITEMS, canUseNavigation, type NavigationItem } from "../../src/lib/navigation/catalog";
import { SALES_TASKS, SALES_TOOL_DESCRIPTIONS, salesToolsForItems, searchSalesTools } from "../../src/lib/workspace/sales-tasks";
import type { UserRole } from "../../src/types/roles";

test("all current sales destinations appear once, with descriptions, for each permitted role", () => {
  for (const role of ["USER", "MANAGER", "ADMIN"] as UserRole[]) {
    const items = NAVIGATION_ITEMS.filter((item) => item.group === "sales" && canUseNavigation(item, role));
    const tools = salesToolsForItems(items);
    const expected = items.filter((item) => item.href !== "/dashboard/work/sales").map((item) => item.href).sort();
    assert.deepEqual(tools.map((tool) => tool.item.href).sort(), expected);
    for (const tool of tools) {
      assert.ok(SALES_TOOL_DESCRIPTIONS[tool.item.href], tool.item.href);
      assert.ok(SALES_TASKS.some((task) => task.id === tool.task));
      assert.ok(tool.title && tool.description);
      assert.equal(tool.item, items.find((item) => item.href === tool.item.href));
    }
  }
});

test("ungranted tools never enter cards, featured links or search; feature gates remain intact", () => {
  const forRole = (role: UserRole, features: string[] = []) => salesToolsForItems(NAVIGATION_ITEMS.filter((item) => canUseNavigation(item, role, features)));
  const user = forRole("USER");
  assert.equal(user.some((tool) => tool.item.href === "/dashboard/outreach-pipeline"), false);
  assert.equal(user.some((tool) => tool.item.href === "/dashboard/auto-sales/history"), false);
  assert.equal(searchSalesTools(user, "加盟").length, 0);
  assert.equal(searchSalesTools(forRole("MANAGER", ["franchise-leads"]), "加盟").length, 1);
  assert.equal(searchSalesTools(forRole("ADMIN"), "加盟").length, 1);
  assert.deepEqual(salesToolsForItems([]), []);
  const suspended = NAVIGATION_ITEMS.filter((item) => canUseNavigation(item, "MANAGER", [], true));
  assert.deepEqual(salesToolsForItems(suspended), []);
});

test("existing labels and aliases remain searchable across all four task groups", () => {
  const tools = salesToolsForItems(NAVIGATION_ITEMS);
  for (const tool of tools) {
    for (const query of [tool.item.label, ...tool.item.aliases]) {
      assert.ok(searchSalesTools(tools, query).some((found) => found.item.href === tool.item.href), query);
    }
  }
  assert.equal(searchSalesTools(tools, "ＴＶｅｒ　相談")[0]?.item.href, "/dashboard/tver-order-link");
  assert.deepEqual(searchSalesTools(tools, "見つからない確認文字列"), []);
});

test("new authorized catalog entries stay reachable without adding unrelated groups", () => {
  const extra: NavigationItem = { href: "/dashboard/future-sales", label: "将来の営業機能", group: "sales", section: "営業", aliases: ["未来の機能"], minRole: "USER" };
  const tools = salesToolsForItems([extra, extra, { ...extra, href: "/dashboard/admin/test", group: "admin" }]);
  assert.equal(tools.length, 1);
  assert.equal(searchSalesTools(tools, "未来")[0].item.href, extra.href);
});
