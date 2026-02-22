import { redirect } from "next/navigation";

// ルートアクセスは常にダッシュボードへ
// 未認証の場合は proxy.ts が /login にリダイレクトする
export default function RootPage() {
  redirect("/dashboard");
}
