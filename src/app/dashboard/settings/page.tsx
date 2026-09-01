import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { OfficeAvatarPicker } from "@/components/settings/office-avatar-picker";
import { proxiedImageUrl } from "@/lib/office/presence";

export default async function SettingsPage() {
  const info = await getSessionInfo();
  if (!info) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: info.userId },
    select: {
      name: true,
      email: true,
      image: true,
      officeAvatar: true,
      notifyViaChat: true,
      notifyViaEmail: true,
      chatSpaceId: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="min-h-full bg-black p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            ダッシュボード
          </Link>
          <h1 className="text-xl font-bold text-white">設定</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {user.name} ({user.email})
          </p>
        </div>

        {/* グループオフィスの顔アイコン */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
          <OfficeAvatarPicker current={user.officeAvatar} googleImage={proxiedImageUrl(user.image, 64)} />
        </div>

        {/* 通知設定 */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
          <NotificationSettingsForm
            notifyViaChat={user.notifyViaChat}
            notifyViaEmail={user.notifyViaEmail}
            chatSpaceId={user.chatSpaceId}
          />
        </div>
      </div>
    </div>
  );
}
