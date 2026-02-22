export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "MISSING",
    AUTH_SECRET: process.env.AUTH_SECRET ? "SET" : "MISSING",
    AUTH_URL: process.env.AUTH_URL ?? "MISSING",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "MISSING",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "SET" : "MISSING",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "SET" : "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  });
}
