import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // standalone 出力（Dockerイメージ軽量化）
  output: "standalone",
  // モバイルAPI等の開発中コードのTSエラーでビルドを止めない
  typescript: { ignoreBuildErrors: true },
  // 動画アップロード対応: プロキシボディサイズ上限
  experimental: {
    proxyClientMaxBodySize: "5gb",
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // nodemailer など Node.js 専用モジュールをクライアントバンドルから除外
  serverExternalPackages: ["nodemailer", "googleapis", "fluent-ffmpeg", "sharp", "puppeteer-core"],
  // Google アカウントのアバター画像を next/image で表示するため許可
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
    ],
  },
  // ----------------------------------------------------------------
  // Ad Arch Studio の自社ドメイン（studio.adarch.co.jp）だけの振り分け（2026-09-20）
  //   Host が studio.adarch.co.jp のときだけ効く。OSのドメインの動きは変わらない。
  //   /mcp・/mcp/creator・/terms・/（＋紹介ページのCSS・画像）だけを窓口へ。それ以外（OSの画面・API・/.well-known 含む）は全部404
  //   ＝OSの認証の案内（oauth-protected-resource 等）を返さない＝AIがログインを求めに来ない
  //   ⚠️ ホスト名は src/lib/studio/host.ts と同じ値（next.config は @/ を import できないため直書き）
  //   beforeFiles は上から順に「続けて」当てはめる（2026-09-20 実測: 前の行で書き換えた後の行き先にも次の行が当たる）。
  //   そのため最後の「それ以外は404」は、前の行の行き先（/api/mcp/public・/creator・/terms・/site）を除いて当てる。
  //   結果として studio ドメインで /api/mcp/public・/creator・/terms・/site を直接開いても同じ公開の中身が返る（OSの情報は無い）
  //   紹介ページのファイルは src/app/api/mcp/public/site/[[...path]]/route.ts が public/studio/ から返す（無いファイルは素の404）
  // ----------------------------------------------------------------
  async rewrites() {
    const studio = [{ type: "host" as const, value: "studio.adarch.co.jp" }];
    return {
      beforeFiles: [
        // 紹介ページ（public/studio/index.html）と、そこから相対パスで読むCSS・画像（拡張子つきのパス）
        { source: "/", has: studio, destination: "/api/mcp/public/site" },
        { source: "/mcp", has: studio, destination: "/api/mcp/public" },
        { source: "/mcp/creator", has: studio, destination: "/api/mcp/public/creator" },
        { source: "/terms", has: studio, destination: "/api/mcp/public/terms" },
        { source: "/:file((?!api/)[^?#]+\\.[A-Za-z0-9]{1,5})", has: studio, destination: "/api/mcp/public/site/:file" },
        // それ以外は全部404（前の行の行き先は除く）
        { source: "/:path((?!api/mcp/public(?:/creator|/terms|/site(?:/.*)?)?$).*)", has: studio, destination: "/api/mcp/public/not-found" },
      ],
      afterFiles: [],
      fallback: [],
    };
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
              "script-src 'self' 'unsafe-inline'",
              // Google Fonts（IBM Plex Sans JP）は申込ページ・営業用LPで使う（2026-09-09）
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Google OAuth リダイレクト・アバター画像／blob: はサイネージプレイヤー（Cache API→blob URL）の画像表示に必要
              "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cyberjapandata.gsi.go.jp https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://images.unsplash.com https://image.mux.com https://*.line-scdn.net",
              // Mux 動画ストリーミング（blob: はHLS再生に必要）
              "media-src 'self' blob: https://stream.mux.com https://*.mux.com",
              // worker（MuxPlayer の HLS ワーカー）
              "worker-src 'self' blob:",
              // Sentry + Mux + Mux Data (litix.io) への送信を許可
              "connect-src 'self' blob: https://*.ingest.sentry.io https://*.mux.com https://*.production.mux.com https://inferred.litix.io https://*.litix.io",
              "font-src 'self' https://fonts.gstatic.com",
              // 埋め込み動画（YouTube / Vimeo / Mux Player / Google Drive）を許可
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://stream.mux.com https://drive.google.com",
              // iframe で本サイトを埋め込まれない（X-Frame-Options と二重防御）
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // HSTS（HTTPS 強制）
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // ソースマップをSentryにアップロード（本番ビルド時のみ）
  silent: !process.env.CI,
  // Webpack tree-shaking でバンドルサイズ最適化
  disableLogger: true,
});
