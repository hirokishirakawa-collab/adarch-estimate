import rawItems from "./items.json";
import { hasMinRole, type UserRole } from "@/types/roles";

export type NavigationGroup =
  | "home"
  | "sales"
  | "projects"
  | "library"
  | "procedures"
  | "admin"
  | "settings";
export interface NavigationItem {
  href: string;
  label: string;
  aliases: string[];
  minRole: UserRole;
  group: NavigationGroup;
  section: string;
  requiredFeature?: string;
  external?: boolean;
}
export const NAVIGATION_ITEMS = rawItems as NavigationItem[];
export const NAVIGATION_GROUPS = [
  {
    id: "home",
    label: "ホーム",
    href: "/dashboard",
    description: "みんなの動きから、今日の一手へ。",
  },
  {
    id: "sales",
    label: "顧客・営業",
    href: "/dashboard/work/sales",
    description: "相手を探す。提案する。結果を残す。",
  },
  {
    id: "projects",
    label: "案件・申請",
    href: "/dashboard/work/projects",
    description: "進み具合を確認して、仕事の続きを。",
  },
  {
    id: "library",
    label: "資料・事例",
    href: "/dashboard/work/library",
    description: "提案と制作に使う材料を、ひとつの入口に。",
  },
  {
    id: "procedures",
    label: "手続き",
    href: "/dashboard/work/procedures",
    description: "自社の報告・請求と、本部とのやり取り。",
  },
  {
    id: "admin",
    label: "本部",
    href: "/dashboard/admin/workspace",
    description: "対応待ちと全社の管理。",
  },
  {
    id: "settings",
    label: "AI・設定",
    href: "/dashboard/ai",
    description: "いつものAIで仕事を進める。",
  },
] as const;

export function canUseNavigation(
  item: NavigationItem,
  role: UserRole,
  features: readonly string[] = [],
  suspended = false,
) {
  if (suspended && role !== "ADMIN")
    return item.href === "/dashboard/sales-report";
  return (
    hasMinRole(role, item.minRole) &&
    (!item.requiredFeature ||
      role === "ADMIN" ||
      features.includes(item.requiredFeature))
  );
}

export function findNavigationItem(path: string) {
  const pathname = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  return NAVIGATION_ITEMS.filter(
    (item) =>
      !item.external &&
      (pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

export function navigationForPath(path: string) {
  const pathname = path.split(/[?#]/)[0].replace(/\/$/, "");
  const hub = NAVIGATION_GROUPS.find((g) => g.href === pathname);
  const item = findNavigationItem(pathname);
  const group =
    hub ??
    NAVIGATION_GROUPS.find((g) => g.id === item?.group) ??
    (pathname.startsWith("/dashboard/admin/")
      ? NAVIGATION_GROUPS.find((g) => g.id === "admin")
      : undefined);
  return { group, item, label: hub?.label ?? item?.label ?? "業務画面" };
}

export function searchNavigation(
  query: string,
  role: UserRole,
  features: readonly string[] = [],
) {
  const words = query
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .split(/\s+/)
    .filter(Boolean);
  const normalize = (value: string) =>
    value.normalize("NFKC").toLocaleLowerCase("ja");
  return NAVIGATION_ITEMS.filter((item) =>
    canUseNavigation(item, role, features),
  )
    .map((item) => {
      const name = normalize([item.label, ...item.aliases].join(" "));
      const section = normalize(item.section);
      const score = words.every(
        (word) => name.includes(word) || section.includes(word),
      )
        ? words.reduce(
            (total, word) =>
              total +
              (normalize(item.label) === word
                ? 20
                : normalize(item.label).startsWith(word)
                  ? 10
                  : name.includes(word)
                    ? 5
                    : 1),
            0,
          )
        : -1;
      return { item, score };
    })
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}
