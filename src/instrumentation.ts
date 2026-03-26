export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 環境変数バリデーション
    const required = ["DATABASE_URL", "AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALLOWED_DOMAIN"];
    const optional = ["ANTHROPIC_API_KEY", "GROUP_SUPPORT_API_KEY", "CRON_SECRET", "RESEND_API_KEY"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error(`[startup] FATAL: Missing required env vars: ${missing.join(", ")}`);
      process.exit(1);
    }
    const unset = optional.filter((k) => !process.env[k]);
    if (unset.length > 0) {
      console.warn(`[startup] WARNING: Optional env vars not set: ${unset.join(", ")}`);
    }

    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@sentry/nextjs").captureRequestError;
