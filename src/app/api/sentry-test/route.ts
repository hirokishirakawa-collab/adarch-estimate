import * as Sentry from "@sentry/nextjs";

export async function GET() {
  Sentry.captureException(new Error("Sentry test error — delete me"));
  return Response.json({ ok: true, message: "Test error sent to Sentry" });
}
