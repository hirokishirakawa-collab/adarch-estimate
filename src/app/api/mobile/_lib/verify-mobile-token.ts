import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export interface MobileTokenPayload {
  email: string;
  name?: string;
  picture?: string;
  role: string;
  enabledFeatures: string[];
  isActive: boolean;
}

export async function verifyMobileToken(
  req: NextRequest
): Promise<MobileTokenPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );

    if (!payload.email || typeof payload.email !== "string") return null;

    const isActive = typeof payload.isActive === "boolean" ? payload.isActive : true;

    // 停止中ユーザーはAPIアクセス拒否
    if (!isActive) return null;

    return {
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
      role: typeof payload.role === "string" ? payload.role : "MANAGER",
      enabledFeatures: Array.isArray(payload.enabledFeatures)
        ? (payload.enabledFeatures as string[])
        : [],
      isActive,
    };
  } catch {
    return null;
  }
}
