import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // パフォーマンスモニタリング（本番は10%サンプリング）
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // リプレイ（エラー時のみ）
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  integrations: [Sentry.replayIntegration()],
});
