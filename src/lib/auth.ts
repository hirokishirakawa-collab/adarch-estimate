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
     * DB に登録されているロールをリアルタイムで取得する（管理者によるロール変更を即座に反映）
     * DB アクセス失敗時は env フォールバック
     */
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        token.email = profile.email;
      }
      const email = (token.email ?? "") as string;
      if (email) {
        try {
          const { db } = await import("@/lib/db");
          const dbUser = await db.user.findUnique({
            where: { email },
            select: { role: true },
          });
          token.role = dbUser?.role ?? resolveRole(email);
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
