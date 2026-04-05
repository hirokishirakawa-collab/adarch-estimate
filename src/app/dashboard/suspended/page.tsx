import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AlertTriangle, Mail, Phone } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SuspendedPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { isActive: true, suspendReason: true, suspendCount: true, name: true },
  });

  if (!user) redirect("/login");

  // アクティブなユーザーはダッシュボードへ
  if (user.isActive) redirect("/dashboard");

  // 月次報告未提出の場合は報告フォームへ誘導
  if (user.suspendReason === "MONTHLY_REPORT" || user.suspendReason === null) {
    redirect("/dashboard/sales-report/new?suspended=1");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-10">
      <div className="max-w-xl w-full">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
          <div className="bg-red-50 border-b border-red-200 px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-red-900">OSへのアクセスが制限されています</h1>
              <p className="text-xs text-red-700 mt-0.5">
                {user.suspendReason === "ROYALTY_UNPAID" && "最低ロイヤリティのお支払いが確認できておりません"}
                {user.suspendReason === "OTHER" && "ご契約内容の確認が必要な状況です"}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {user.suspendReason === "ROYALTY_UNPAID" && (
              <>
                <div className="text-sm text-zinc-700 leading-relaxed space-y-3">
                  <p>
                    {user.name} 様のアカウントは、<strong>最低ロイヤリティの入金が確認できていない</strong>状況のため、
                    Ad Arch OS 各機能のご利用を一時停止しております。
                  </p>
                  <p>
                    Ad Arch OS は「ブランド・媒体仕入れ・本部サポート・各種AIツール」を含む
                    ネットワーク参加費（ロイヤリティ）をお支払いいただいているパートナー様への提供機能です。
                    お支払いが確認でき次第、アクセスを復旧いたします。
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-900 mb-1">ご対応のお願い</p>
                  <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4">
                    <li>お振込予定日・領収書・ご事情などを本部までご連絡ください</li>
                    <li>お支払い後、アクセス復旧には1〜2営業日いただく場合があります</li>
                    <li>ご事情のある場合（一時的な資金繰り等）は個別にご相談ください</li>
                  </ul>
                </div>
              </>
            )}

            {user.suspendReason === "OTHER" && (
              <div className="text-sm text-zinc-700 leading-relaxed space-y-3">
                <p>
                  {user.name} 様のアカウントは、契約内容の確認が必要な状況のため、
                  Ad Arch OS 各機能のご利用を一時停止しております。
                </p>
                <p>
                  詳細につきましては本部よりご連絡いたします。
                  恐れ入りますが、ご不明点は本部までご連絡ください。
                </p>
              </div>
            )}

            <div className="border-t border-zinc-200 pt-4 space-y-2">
              <p className="text-xs font-semibold text-zinc-600">本部連絡先</p>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <Mail className="w-4 h-4 text-zinc-400" />
                <a href="mailto:info@adarch.co.jp" className="text-blue-600 hover:underline">
                  info@adarch.co.jp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
