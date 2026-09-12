// ローカル検証専用: テストDBに接続行(OAuthGrant)を作り、アクセストークンを表示する
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
const url = process.env.TEST_DB_URL!;
if (!url.includes("localhost")) throw new Error("local only");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
async function main() {
  const email = process.env.MCP_EMAIL ?? "demo@adarch.co.jp";
  const g = await db.oAuthGrant.create({ data: { tokenHash: `test_${Date.now()}`, clientId: "test-client", clientName: "LocalTest", userEmail: email, scope: "brand_kit os:read os:write", expiresAt: new Date(Date.now() + 86400000) } });
  const secret = new TextEncoder().encode(`mcp:${process.env.AUTH_SECRET}`);
  const t = await new SignJWT({ cid: "test-client", gid: g.id, scope: "brand_kit os:read os:write" })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" }).setIssuer("adarch-os-mcp").setAudience(`${process.env.AUTH_URL}/api/mcp`).setSubject(email).setIssuedAt().setExpirationTime("1h").sign(secret);
  console.log(t);
}
main().finally(() => db.$disconnect());
