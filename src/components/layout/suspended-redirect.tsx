"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** 停止中のユーザーを理由別にリダイレクト */
const REPORT_ALLOWED = ["/dashboard/sales-report"];
const ROYALTY_ALLOWED = ["/dashboard/suspended"];

export function SuspendedRedirect({ suspendReason }: { suspendReason: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // ロイヤリティ未払い / その他は専用停止ページへ
    if (suspendReason === "ROYALTY_UNPAID" || suspendReason === "OTHER") {
      const isAllowed = ROYALTY_ALLOWED.some((p) => pathname.startsWith(p));
      if (!isAllowed) {
        router.replace("/dashboard/suspended");
      }
      return;
    }

    // 月次報告未提出（デフォルト）は報告フォームへ
    const isAllowed = REPORT_ALLOWED.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      router.replace("/dashboard/sales-report/new?suspended=1");
    }
  }, [pathname, router, suspendReason]);

  return null;
}
