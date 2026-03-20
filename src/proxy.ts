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
// 不正アクセス検知: 簡易レートリミット（メモリ内）
// ----------------------------------------------------------------
const accessAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1分間
const RATE_LIMIT_MAX = 30; // 1分間に30回以上の未認証アクセスで検知

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = accessAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    accessAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  // 古いエントリを掃除（100件超えたら期限切れを削除）
  if (accessAttempts.size > 100) {
    for (const [key, val] of accessAttempts) {
      if (now > val.resetAt) accessAttempts.delete(key);
    }
  }
  return entry.count > RATE_LIMIT_MAX;
}

// ----------------------------------------------------------------
// ヘルパー: IP・UA取得
// ----------------------------------------------------------------
function getClientInfo(req: NextAuthRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  return { ipAddress, userAgent };
}

/** 通知が必要なセキュリティイベント */
const ALERT_ACTIONS = new Set([
  "rate_limit_exceeded",
  "unauthorized_access",
]);

/** セキュリティ通知先スペース */
const SECURITY_CHAT_SPACE_ID = "AAQAxSqou_g";

/**
 * 監査ログを記録 + 重要度の高いイベントは Google Chat に即時通知
 */
async function recordSecurityEvent(
  action: string,
  detail: string,
  email: string | null,
  ipAddress: string,
  userAgent: string,
) {
  // 1. DB に監査ログ記録
  try {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      action,
      email: email ?? "anonymous",
      detail,
      ipAddress,
      userAgent,
    });
  } catch {
    console.error(`[Security] ログ記録失敗: ${action} ${detail}`);
  }

  // 2. 重要イベントは Google Chat に即時通知
  if (ALERT_ACTIONS.has(action)) {
    try {
      const { sendChatMessage } = await import("@/lib/google-chat");
      const labels: Record<string, string> = {
        rate_limit_exceeded: "大量アクセス検知（レートリミット超過）",
        unauthorized_access: "権限外アクセス検知",
      };
      const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      const text = [
        `🚨 ${labels[action] ?? action}`,
        `時刻: ${now}`,
        `IP: ${ipAddress}`,
        `ユーザー: ${email ?? "anonymous"}`,
        `詳細: ${detail}`,
        `UA: ${userAgent.slice(0, 100)}`,
      ].join("\n");
      await sendChatMessage(SECURITY_CHAT_SPACE_ID, text);
    } catch {
      console.error(`[Security] Chat通知失敗: ${action}`);
    }
  }
}

// ----------------------------------------------------------------
// ミドルウェア本体
// ----------------------------------------------------------------
export default auth((req: NextAuthRequest) => {
  const { auth: session, nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isAuthenticated = !!session;
  const { ipAddress, userAgent } = getClientInfo(req);

  // 1. 公開パスはそのまま通す
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // ログイン済みがログインページにきたらホームへ
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 2. 未認証アクセス → ログ記録 + レートリミットチェック
  if (!isAuthenticated) {
    const isRateLimited = checkRateLimit(ipAddress);

    if (isRateLimited) {
      // 大量アクセス検知 → 429 返却 + ログ
      recordSecurityEvent(
        "rate_limit_exceeded",
        `path=${pathname} ip=${ipAddress}`,
        null,
        ipAddress,
        userAgent,
      );
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    // 通常の未認証アクセス（センシティブなパスのみログ記録）
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/")) {
      recordSecurityEvent(
        "unauthenticated_access",
        `path=${pathname}`,
        null,
        ipAddress,
        userAgent,
      );
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. ロールベースのアクセス制御
  const userRole = session.user?.role as UserRole | undefined;
  const userEmail = session.user?.email ?? "unknown";

  for (const { prefix, role } of PROTECTED_PATHS) {
    if (pathname.startsWith(prefix)) {
      if (!userRole || !hasMinRole(userRole, role)) {
        // 権限不足 → ログ記録
        recordSecurityEvent(
          "unauthorized_access",
          `path=${pathname} required=${role} actual=${userRole ?? "none"}`,
          userEmail,
          ipAddress,
          userAgent,
        );
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
    "/((?!api/auth|api/cron|api/group-support|api/portfolio/sync|api/tracking|api/telegram|group-support/submit|p/|_next/static|_next/image|favicon.ico|logo-adarch\\.png|public).*)",
  ],
};
