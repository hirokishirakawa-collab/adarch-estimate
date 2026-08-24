import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LiveBoard } from "@/components/live/live-board";

// グループ稼働ライブボード — 「今、誰がどこに当たっているか」を管制室風に流す
export default async function LivePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  // デモアカウント・停止中ユーザーには実社名フィードを見せない
  if (session.user.email === "demo@adarch.co.jp" || session.user.isActive === false)
    redirect("/dashboard");
  return <LiveBoard />;
}
