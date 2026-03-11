export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@sentry/nextjs").captureRequestError;
