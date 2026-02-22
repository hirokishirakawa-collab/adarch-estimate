import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
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
// ロール判定ロジック
// Phase 2（DB実装後）はDBからロールを取得する
// ----------------------------------------------------------------
function resolveRole(email: string): UserRole {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return "ADMIN";
  // Phase 1: ADMIN以外は暫定的にMANAGER（代表）として扱う
  // Phase 2: DBのusersテーブルからrole/branchIdを取得して判定する
  return "MANAGER";
}

// ----------------------------------------------------------------
// NextAuth 設定
// ----------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    /**
     * ログイン可否の判定
     * @ad-arch.co.jp 以外のドメインは拒否
     */
    async signIn({ profile }) {
      if (!profile?.email) return false;

      const domain = profile.email.split("@")[1]?.toLowerCase();
      if (domain !== ALLOWED_DOMAIN) {
        console.warn(`[Auth] ドメイン拒否: ${profile.email}`);
        return false;
      }

      return true;
    },

    /**
     * JWT トークンにロールを付与
     * account は初回サインイン時のみ存在するが、
     * role は毎回 env から再解決する（ADMIN_EMAILS の変更を即座に反映）
     */
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        token.email = profile.email;
      }
      // 毎回ロールを再解決（古いセッションでも正しいロールを返す）
      const email = (token.email ?? "") as string;
      if (email) {
        token.role = resolveRole(email);
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
