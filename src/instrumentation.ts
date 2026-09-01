export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 環境変数バリデーション（ビルド時はスキップ）
    if (process.env.NODE_ENV !== "production" || process.env.DATABASE_URL) {
      const required = ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_DOMAIN"];
      const optional = ["ANTHROPIC_API_KEY", "GROUP_SUPPORT_API_KEY", "CRON_SECRET", "RESEND_API_KEY", "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID", "MF_CLIENT_ID", "MF_CLIENT_SECRET"];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length > 0) {
        console.error(`[startup] FATAL: Missing required env vars: ${missing.join(", ")}`);
        process.exit(1);
      }
      const unset = optional.filter((k) => !process.env[k]);
      if (unset.length > 0) {
        console.warn(`[startup] WARNING: Optional env vars not set: ${unset.join(", ")}`);
      }
    }

    await import("../sentry.server.config");

    // LINE のステップ配信・予約一斉配信（本番のみ・60秒ごと）
    if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
      const { startLineScheduler } = await import("./lib/line/scheduler");
      startLineScheduler();
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@sentry/nextjs").captureRequestError;
