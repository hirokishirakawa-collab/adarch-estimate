import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LiveBoard } from "@/components/live/live-board";

// グループ稼働ライブボード — 「今、誰がどこに当たっているか」を管制室風に流す
export default async function LivePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  return <LiveBoard />;
}
