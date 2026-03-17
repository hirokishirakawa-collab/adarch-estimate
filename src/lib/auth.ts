import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { headers } from "next/headers";
import type { UserRole } from "@/types/roles";

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
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    /**
     * ログイン可否の判定
     * @ad-arch.co.jp 以外のドメインは拒否
     */
    async signIn({ profile }) {
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

        // Gmail トークンを DB に保存（初回ログイン / 再認証時）
        if (account.access_token) {
          try {
            const { db } = await import("@/lib/db");
            await db.user.update({
              where: { email: profile.email },
              data: {
                gmailAccessToken: account.access_token,
                gmailRefreshToken: account.refresh_token ?? undefined,
                gmailTokenExpiry: account.expires_at
                  ? new Date(account.expires_at * 1000)
                  : undefined,
              },
            });
          } catch {
            // ユーザーが未登録の場合は無視（signIn後にupsertされる）
          }
        }
      }
      const email = (token.email ?? "") as string;
      if (email) {
        try {
          const { db } = await import("@/lib/db");
          const dbUser = await db.user.findUnique({
            where: { email },
            select: { role: true, enabledFeatures: true, gmailAccessToken: true },
          });
          token.role = dbUser?.role ?? resolveRole(email);
          token.enabledFeatures = dbUser?.enabledFeatures ?? [];
          token.hasGmail = !!dbUser?.gmailAccessToken;
        } catch {
          // DB エラー時は env ベースのフォールバック
          token.role = resolveRole(email);
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
        session.user.hasGmail = (token.hasGmail as boolean) ?? false;
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
  },
});
