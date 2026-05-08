"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const ALLOWED_PATHS = ["/dashboard/contract-expired"];

export function ContractExpiredRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isAllowed = ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      router.replace("/dashboard/contract-expired");
    }
  }, [pathname, router]);

  return null;
}
