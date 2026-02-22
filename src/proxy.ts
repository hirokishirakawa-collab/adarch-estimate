import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasMinRole } from "@/types/roles";
import type { UserRole } from "@/types/roles";
import type { NextAuthRequest } from "next-auth";

// ----------------------------------------------------------------
// パス設定
// ----------------------------------------------------------------

/** 認証なしでアクセス可能なパス */
const PUBLIC_PATHS = ["/login"];

/**
 * ロールごとの保護パス
 *
 * /admin       → ADMIN（本部）のみ
 * /sales-report → MANAGER以上（代表は自拠点のみ、Phase 2で branchId フィルタ）
 */
const PROTECTED_PATHS: { prefix: string; role: UserRole }[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/sales-report", role: "MANAGER" },
];

// ----------------------------------------------------------------
// ミドルウェア本体
// ----------------------------------------------------------------
export default auth((req: NextAuthRequest) => {
  const { auth: session, nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isAuthenticated = !!session;

  // 1. 公開パスはそのまま通す
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // ログイン済みがログインページにきたらホームへ
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 2. 未認証はログインページへリダイレクト
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. ロールベースのアクセス制御
  const userRole = session.user?.role as UserRole | undefined;

  for (const { prefix, role } of PROTECTED_PATHS) {
    if (pathname.startsWith(prefix)) {
      if (!userRole || !hasMinRole(userRole, role)) {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
      break;
    }
  }

  return NextResponse.next();
});

// ----------------------------------------------------------------
// マッチャー: 静的ファイルと Next.js 内部パスを除外
// ----------------------------------------------------------------
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
