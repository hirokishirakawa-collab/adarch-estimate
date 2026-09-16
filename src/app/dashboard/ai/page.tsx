import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AiWorkButton } from "@/components/workspace/ai-work-button";
export default async function AiWorkspacePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const grants = await db.oAuthGrant.findMany({
    where: {
      userEmail: session.user.email,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { clientName: true },
  });
  const tasks = [
    ["今日の一手", "my_next_actionsで今日進める仕事を確認する"],
    ["顧客への提案", "対象の顧客を確認し、過去のやり取りと提案材料を整理する"],
    ["活動の記録", "会話で確認した営業活動をOSに記録する"],
    ["週次共有", "今週の記録を振り返り、週次共有の内容を確認する"],
  ];
  return (
    <div className="os-page">
      <div className="os-page-head">
        <div>
          <h1>AIで進める</h1>
          <p className="os-description">
            いつものClaude／ChatGPTで準備・記録。OSで内容と進み具合を確認。
          </p>
        </div>
        <Link className="os-button-secondary" href="/dashboard/ai-connect">
          接続を設定
        </Link>
      </div>
      <p className="os-notice">
        {grants.length
          ? `接続済み：${[...new Set(grants.map((g) => g.clientName ?? "AIクライアント"))].join("・")}`
          : "AIは未接続です。接続を設定すると、OSの最新情報を使って仕事を進められます。"}
      </p>
      {tasks.map(([label, task]) => (
        <div className="os-action-row" key={label}>
          <div className="os-action-copy">
            <h3>{label}</h3>
            <p>{task.replace("my_next_actionsで", "")}</p>
          </div>
          <AiWorkButton
            connected={grants.length > 0}
            secondary
            context={{ label, task, path: "/dashboard/ai" }}
            label="依頼文を用意"
          />
        </div>
      ))}
      <p className="os-footnote">
        顧客・商談の画面から「AIで進める」を開くと、その対象を含めた依頼文になります。準備・送付・結果の記録はそれぞれの状態で確認します。
      </p>
    </div>
  );
}
