import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { hasMinRole } from "@/types/roles";
import type { UserRole } from "@/types/roles";
import type { NextAuthRequest } from "next-auth";

// ----------------------------------------------------------------
// パス設定
// ----------------------------------------------------------------

/** 認証なしでアクセス可能なパス */
const PUBLIC_PATHS = ["/login", "/partner"];

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
// IPブロックリスト（個別IP + CIDRレンジ）
// ----------------------------------------------------------------
/** ハードコードされたブロックIP */
const HARDCODED_BLOCKED_IPS = new Set([
  "104.198.89.53", // 2026-04-13 GCP bot: /dashboard/studio への大量アクセス
  "45.148.10.21",  // 2026-04-20 .env/credentials スキャンボット
  "45.88.138.44",  // 2026-05-17 設定ファイル探索ボット (pip.conf, .terraform, .vercel など)
  "146.190.63.248", // 2026-05-17 leakix.net 公開スキャナー (DigitalOcean)
]);

/** 環境変数からの追加ブロックIP（カンマ区切り） */
const ENV_BLOCKED_IPS = (process.env.BLOCKED_IPS ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

const BLOCKED_IPS = new Set([...HARDCODED_BLOCKED_IPS, ...ENV_BLOCKED_IPS]);

/**
 * ブロック対象CIDRレンジ（[ipBase, prefixLength]）
 * GCP 34.128.0.0/10: 34.128.x.x〜34.191.x.x — スキャナーの温床
 */
const BLOCKED_CIDRS: [number, number][] = [
  [ipToNumber("34.128.0.0"), 10], // GCP — 34.128.0.0〜34.191.255.255
];

function ipToNumber(ip: string): number {
  const parts = ip.split(".");
  return ((+parts[0]) << 24 | (+parts[1]) << 16 | (+parts[2]) << 8 | (+parts[3])) >>> 0;
}

function isBlockedIp(ip: string): boolean {
  if (BLOCKED_IPS.has(ip)) return true;
  const ipNum = ipToNumber(ip);
  for (const [base, prefix] of BLOCKED_CIDRS) {
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
    if ((ipNum & mask) === (base & mask)) return true;
  }
  return false;
}

// ----------------------------------------------------------------
// スキャナーが狙う不正パス（即403）
// ----------------------------------------------------------------
const BLOCKED_PATH_PATTERNS: RegExp[] = [
  // 環境変数・機密ファイル
  /\.env($|\.)/, // .env, .env.local, .env.production, .env.save 等
  /\/(credentials|secrets|private[_-]?key|id_rsa)/i,
  /\/auth\.json$/,
  /\/google-services\.json$/,
  // バージョン管理・OS
  /\.(git|svn|hg)(\/|$)/,
  /\.(DS_Store|htaccess|htpasswd)$/,
  /\/Thumbs\.db$/,
  // WordPress
  /\/(wp-admin|wp-login|wp-content|wordpress|xmlrpc\.php)/,
  // PHP / DB管理
  /\.(php|aspx?|axd|cgi)($|\?)/,  // Next.jsにPHP/ASP/CGIは存在しない
  /\/(phpinfo|phpmyadmin|pma|adminer|mysql)/i,
  // .NET / Java / Python / Ruby 設定
  /\/(web\.config|appsettings\.\w+\.json)$/,
  /\/(appveyor|appspec|buildspec|Jenkinsfile|Vagrantfile)\.(yml|yaml|json)$/,
  /\/(webpack\.mix\.js|composer\.(json|lock)|Gemfile|tox\.ini|setup\.cfg)$/,
  /\/Trace\.axd$/,
  // IDE設定
  /\/\.vscode(-server)?\//,
  // 偽管理画面・内部API探索
  /\/admin\/(master|console|config|login|panel)/i,
  /\/api\/(http\/routers|requestlogs|swagger|graphql)/i,
  // クラウド/IaC 設定ファイル探索（2026-05-17 45.88.138.44 攻撃由来）
  /\/pip\.conf$/i,
  /\/netlify\.toml$/i,
  /\.terraform(\/|$)/i,
  /\/terraform\.tfstate/i,
  /\.vercel(\/|$)/i,
  // メトリクス/プロキシ/デバッグエンドポイント探索
  /^\/(metrics|proxy|api\/proxy)(\/|$)/i,
  /\/debug\/(default\/)?view/i,
  /\/actuator(\/|$)/i,        // Spring Boot Actuator
  /\/_profiler(\/|$)/i,       // Symfony / Laravel
  /\/server-status$/i,        // Apache mod_status
];

// ----------------------------------------------------------------
// スキャナー User-Agent ブロック（自己申告型スキャナーを先回り遮断）
// ----------------------------------------------------------------
const BLOCKED_UA_PATTERNS: RegExp[] = [
  /l9scan/i,                  // leakix.net
  /leakix/i,
  /censys/i,
  /shodan/i,
  /zgrab/i,                   // 大規模ポートスキャナー
  /masscan/i,
  /nuclei/i,                  // Vulnerability scanner
  /sqlmap/i,                  // SQL injection scanner
  /nikto/i,                   // Web server scanner
  /acunetix/i,
  /netsparker/i,
];

function isBlockedUserAgent(ua: string): boolean {
  if (!ua || ua === "unknown") return false;
  return BLOCKED_UA_PATTERNS.some((re) => re.test(ua));
}

function isBlockedPath(pathname: string): boolean {
  return BLOCKED_PATH_PATTERNS.some((re) => re.test(pathname));
}

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
const SECURITY_CHAT_SPACE_ID = process.env.SECURITY_CHAT_SPACE_ID ?? "AAQAxSqou_g";

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
  const hostname = req.headers.get("host") || "";

  // 0a. IPブロックリストチェック
  if (isBlockedIp(ipAddress)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 0b. スキャナー UA を自己申告で名乗るボット → 即403
  if (isBlockedUserAgent(userAgent)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 0c. スキャナーが狙う不正パス → 即403（ログ・レートリミット不要）
  if (isBlockedPath(pathname)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 0d. 商談予約システムの公開ページ・API（認証不要）
  //     IP/UA/不正パスのブロック(0a〜0c)は通過済み。各APIは内部で
  //     IPレートリミット＋トークン認可（connectToken/cancelToken）を行う
  if (pathname === "/book" || pathname.startsWith("/book/") || pathname.startsWith("/api/book/")) {
    return NextResponse.next();
  }

  // 0. creators.adarch.co.jp → /creators 配下にリライト
  if (hostname.startsWith("creators.adarch.co.jp")) {
    if (pathname.startsWith("/creators")) {
      // 既に /creators パスならそのまま通す
      return NextResponse.next();
    }
    // ルート → /creators、それ以外 → /creators + pathname にリライト
    const target = pathname === "/" || pathname === ""
      ? "/creators"
      : `/creators${pathname}`;
    return NextResponse.rewrite(new URL(target, req.url));
  }

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

    // 通常の未認証アクセス（センシティブなパスのみログ記録、Telegram webhookは除外）
    if ((pathname.startsWith("/admin") || pathname.startsWith("/api/")) && !pathname.startsWith("/api/telegram")) {
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

  // 3. アカウント停止チェック（月次報告関連のAPIは許可）
  const isActive = session.user?.isActive ?? true;
  if (!isActive && pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    // 停止中でも月次報告の提出に必要なAPIは通す
    const suspendedAllowedPrefixes = [
      "/api/favorites",       // サイドバー描画用
    ];
    const isSuspendedAllowed = suspendedAllowedPrefixes.some((p) => pathname.startsWith(p));
    if (!isSuspendedAllowed) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }
  }

  // 4. ロールベースのアクセス制御
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
    // api/franchise-leads/intake・booking-signal はGAS(Bearer CRON_SECRET)からのPOSTを受けるため除外
    // （両ルートはハンドラ内でセッション or Bearer を自前検証する）
    // 自動営業の5ルートは 2026-08-17 の廃止で削除済みのため、除外指定も外した。
    "/((?!api/auth|api/cron|api/contact|api/lp-view|api/franchise-leads/intake|api/franchise-leads/booking-signal|api/group-support|api/portfolio/sync|api/tracking|api/telegram|api/storage|api/creators|group-support/submit|test-form|p/|partner|creators|dashboard/studio/share/|_next/static|_next/image|favicon.ico|logo-adarch\\.png|logo_white\\.png|groupLogo_yoko_White\\.png|public).*)",
  ],
};
