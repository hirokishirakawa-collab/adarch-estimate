import type { DefaultSession } from "next-auth";
import type { UserRole } from "./roles";

// next-auth の型を拡張し、Session と JWT に role / enabledFeatures を追加
declare module "next-auth" {
  interface Session {
    user: {
      role: UserRole;
      email: string;
      enabledFeatures: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    email?: string;
    enabledFeatures?: string[];
  }
}
