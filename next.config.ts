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
            // camera/microphone=(self): グループオフィスの5分音声（LiveKit）で使う。第三者フレームには開けない
            value: "camera=(self), microphone=(self), geolocation=(), payment=()",
          },
          // XSS 対策（モダンブラウザ向け）
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js の inline script / style を許可
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              // Google OAuth リダイレクト・アバター画像／blob: はサイネージプレイヤー（Cache API→blob URL）の画像表示に必要
              "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cyberjapandata.gsi.go.jp https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://images.unsplash.com https://image.mux.com https://*.line-scdn.net",
              // Mux 動画ストリーミング（blob: はHLS再生に必要）
              "media-src 'self' blob: https://stream.mux.com https://*.mux.com",
              // worker（MuxPlayer の HLS ワーカー）
              "worker-src 'self' blob:",
              // Sentry + Mux + Mux Data (litix.io) への送信を許可
              // LiveKit Cloud（グループオフィスの音声）は wss + https の両方に繋ぐ
              "connect-src 'self' blob: https://*.ingest.sentry.io https://*.mux.com https://*.production.mux.com https://inferred.litix.io https://*.litix.io wss://*.livekit.cloud https://*.livekit.cloud",
              "font-src 'self'",
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
