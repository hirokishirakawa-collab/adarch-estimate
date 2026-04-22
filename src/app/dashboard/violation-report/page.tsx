import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { ViolationReportForm } from "@/components/partner-status/violation-report-form";

export default async function ViolationReportPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center">
          <Flag
            className="text-zinc-600"
            style={{ width: "1.125rem", height: "1.125rem" }}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">コンプライアンス相談</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            グループの信頼を守るため、気になる行為を発見された場合はこちらからご相談ください。匿名でのご相談も可能です。
          </p>
        </div>
      </div>

      {/* 通報フォーム */}
      <ViolationReportForm />
    </div>
  );
}
