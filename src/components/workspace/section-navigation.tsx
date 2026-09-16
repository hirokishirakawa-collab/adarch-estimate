"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationForPath } from "@/lib/navigation/catalog";

const related = {
  sales: [
    { href: "/dashboard/leads/list", label: "見込み先" },
    { href: "/dashboard/customers", label: "顧客" },
    { href: "/dashboard/deals", label: "商談" },
    { href: "/dashboard/estimates", label: "見積" },
  ],
  projects: [
    { href: "/dashboard/projects", label: "案件" },
    { href: "/dashboard/tver", label: "TVer" },
    { href: "/dashboard/media", label: "媒体依頼" },
  ],
  library: [
    { href: "/dashboard/library", label: "資料を検索" },
    { href: "/dashboard/packages", label: "商品・媒体" },
    { href: "/dashboard/portfolio", label: "実績" },
    { href: "/dashboard/wiki", label: "手順" },
  ],
};
export function SectionNavigation() {
  const pathname = usePathname();
  const { group, label } = navigationForPath(pathname);
  if (!group || pathname === group.href || pathname === "/dashboard/live")
    return null;
  const links = related[group.id as keyof typeof related] ?? [];
  return (
    <nav className="os-section-nav" aria-label="現在地と関連する画面">
      <div>
        <Link href={group.href}>{group.label}</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">{label}</span>
      </div>
      {links.length > 0 && (
        <div className="os-section-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "page"
                  : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
