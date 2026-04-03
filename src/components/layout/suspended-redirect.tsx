"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** 停止中のユーザーが月次報告以外のページにいる場合、月次報告ページへリダイレクト */
const ALLOWED_PREFIXES = ["/dashboard/sales-report"];

export function SuspendedRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isAllowed = ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      router.replace("/dashboard/sales-report/new?suspended=1");
    }
  }, [pathname, router]);

  return null;
}
