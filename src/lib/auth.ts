import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import type { UserRole } from "@/types/roles";

// ----------------------------------------------------------------
// デモアカウント（App Store 審査用）
// ----------------------------------------------------------------
const DEMO_EMAIL = "demo@adarch.co.jp";
const DEMO_PASSWORD = "AdArch2016!";
const DEMO_USER_NAME = "Demo User";

// ----------------------------------------------------------------
// 設定値（環境変数から取得）
// ----------------------------------------------------------------
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN ?? "adarch.co.jp";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// ----------------------------------------------------------------
// フォールバック用ロール判定（DBアクセス不可時）
// ----------------------------------------------------------------
function resolveRole(email: string): UserRole {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return "ADMIN";
  return "MANAGER";
}

// ----------------------------------------------------------------
// NextAuth 設定
// ----------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
          return {
            id: "demo-user",
            name: DEMO_USER_NAME,
            email: DEMO_EMAIL,
          };
        }
        return null;
      },
    }),
  ],

  callbacks: {
    /**
     * ログイン可否の判定
     * @ad-arch.co.jp 以外のドメインは拒否
     */
    async signIn({ profile, credentials, account }) {
      // デモアカウント（Credentials プロバイダー）はドメインチェック不要
      if (account?.provider === "demo") return true;

      // ログ記録用にリクエスト情報を取得
      let ipAddress: string | null = null;
      let userAgent: string | null = null;
      try {
        const hdrs = await headers();
        ipAddress =
          hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          hdrs.get("x-real-ip") ??
          null;
        userAgent = hdrs.get("user-agent") ?? null;
      } catch {
        // headers() が取得できない場合は無視
      }

      if (!profile?.email) return false;

      const domain = profile.email.split("@")[1]?.toLowerCase();
      if (domain !== ALLOWED_DOMAIN) {
        console.warn(`[Auth] ドメイン拒否: ${profile.email}`);
        const { logAudit } = await import("@/lib/audit");
        await logAudit({
          action: "login_failed",
          email: profile.email,
          name: (profile.name as string) ?? null,
          detail: "domain_rejected",
          ipAddress,
          userAgent,
        });
        // 不正ログイン試行を Google Chat に即時通知
        try {
          const { sendChatMessage } = await import("@/lib/google-chat");
          const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
          await sendChatMessage(process.env.SECURITY_CHAT_SPACE_ID ?? "AAQAxSqou_g", [
            `🚨 不正ログイン試行検知`,
            `時刻: ${now}`,
            `メール: ${profile.email}`,
            `名前: ${(profile.name as string) ?? "不明"}`,
            `IP: ${ipAddress ?? "不明"}`,
            `理由: 許可外ドメイン（${domain}）`,
          ].join("\n"));
        } catch {
          // 通知失敗してもログイン拒否は継続
        }
        return false;
      }

      // 成功ログを記録
      const { logAudit } = await import("@/lib/audit");
      await logAudit({
        action: "login_success",
        email: profile.email,
        name: (profile.name as string) ?? null,
        ipAddress,
        userAgent,
      });

      return true;
    },

    /**
     * JWT トークンにロールを付与
     * DB に登録されているロールをリアルタイムで取得する（管理者によるロール変更を即座に反映）
     * DB アクセス失敗時は env フォールバック
     */
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        token.email = profile.email;
      }
      // Credentials（デモ）ログイン時は account.provider で email をセット
      if (account?.provider === "demo") {
        token.email = DEMO_EMAIL;
        token.name = DEMO_USER_NAME;
      }
      const email = (token.email ?? "") as string;

      // デモアカウントは DB ルックアップ不要（MANAGER ロールで閲覧）
      if (email === DEMO_EMAIL) {
        token.role = "MANAGER";
        token.enabledFeatures = [];
        token.isActive = true;
        token.isDemo = true;
        return token;
      }

      if (email) {
        try {
          const { db } = await import("@/lib/db");
          const dbUser = await db.user.findUnique({
            where: { email },
            select: { role: true, enabledFeatures: true, isActive: true },
          });
          token.role = dbUser?.role ?? resolveRole(email);
          token.enabledFeatures = dbUser?.enabledFeatures ?? [];
          token.isActive = dbUser?.isActive ?? true;
        } catch (e) {
          // DB エラー時は env ベースのフォールバック（アクセスは許可、ロールのみフォールバック）
          console.error("[auth] DB lookup failed, using fallback:", e instanceof Error ? e.message : e);
          token.role = resolveRole(email);
          token.isActive = true;
        }
      }
      return token;
    },

    /**
     * Session オブジェクトにロール情報を注入
     * クライアントサイドから useSession() で参照可能になる
     */
    async session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role as UserRole;
        session.user.email = token.email as string;
        session.user.enabledFeatures = (token.enabledFeatures as string[]) ?? [];
        session.user.isActive = (token.isActive as boolean) ?? true;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24時間でセッション失効 → 再ログイン必須
  },
});
