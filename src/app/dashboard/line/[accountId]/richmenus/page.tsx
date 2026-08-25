import { db } from "@/lib/db";
import { loadAccountPage } from "@/lib/line/page-helpers";
import { AccountHeader } from "@/components/line/account-header";
import { RichMenuManager } from "@/components/line/richmenu-manager";
import { RICH_MENU_LAYOUTS, parseRichMenuAreas } from "@/lib/line/service";

export const dynamic = "force-dynamic";

export default async function LineRichMenusPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { account } = await loadAccountPage(accountId);
  const [rows, tagDefs, linked] = await Promise.all([
    db.lineRichMenu.findMany({
      where: { accountId },
      orderBy: [{ isDefault: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, layout: true, chatBarText: true, areas: true, imageType: true, lineRichMenuId: true, isDefault: true, ruleTag: true, priority: true, lastError: true },
    }),
    db.lineTag.findMany({ where: { accountId }, select: { name: true }, orderBy: { order: "asc" } }),
    db.lineFriend.groupBy({ by: ["richMenuId"], where: { accountId, richMenuId: { not: null } }, _count: { _all: true } }),
  ]);
  const linkedCount = new Map(linked.map((l) => [l.richMenuId, l._count._all]));
  const menus = rows.map((m) => ({
    id: m.id, name: m.name, layout: m.layout, chatBarText: m.chatBarText, areas: parseRichMenuAreas(m.areas),
    hasImage: !!m.imageType, lineRichMenuId: m.lineRichMenuId, isDefault: m.isDefault, ruleTag: m.ruleTag, priority: m.priority,
    lastError: m.lastError, linkedCount: linkedCount.get(m.id) ?? 0,
  }));
  const layouts = Object.entries(RICH_MENU_LAYOUTS).map(([key, l]) => ({ key, label: l.label, cols: l.cols, rows: l.rows, width: l.width, height: l.height }));

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      <AccountHeader account={account} />
      <RichMenuManager accountId={accountId} layouts={layouts} menus={menus} tagNames={tagDefs.map((t) => t.name)} />
    </div>
  );
}
