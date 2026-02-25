import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer など Node.js 専用モジュールをクライアントバンドルから除外
  serverExternalPackages: ["nodemailer", "googleapis"],
  // Google アカウントのアバター画像を next/image で表示するため許可
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
    ],
  },
  // ----------------------------------------------------------------
  // セキュリティヘッダー（全レスポンスに付与）
  // ----------------------------------------------------------------
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // クリックジャッキング対策: iframe 埋め込みを全面禁止
          { key: "X-Frame-Options", value: "DENY" },
          // MIME スニッフィング対策
          { key: "X-Content-Type-Options", value: "nosniff" },
          // リファラー情報の漏洩抑制
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 不要なブラウザ機能の無効化
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // XSS 対策（モダンブラウザ向け）
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js の inline script / style を許可
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Google OAuth リダイレクト・アバター画像
              "img-src 'self' data: https://lh3.googleusercontent.com https://lh4.googleusercontent.com",
              "connect-src 'self'",
              "font-src 'self'",
              // iframe 禁止（X-Frame-Options と二重防御）
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
