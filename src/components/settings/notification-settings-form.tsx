"use client";

import { useActionState } from "react";
import { Bell, MessageSquare, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { updateNotificationSettings } from "@/lib/actions/notification-settings";

interface Props {
  notifyViaChat: boolean;
  notifyViaEmail: boolean;
  hasChatSpaceId: boolean;
}

export function NotificationSettingsForm({
  notifyViaChat,
  notifyViaEmail,
  hasChatSpaceId,
}: Props) {
  const [state, action, isPending] = useActionState(updateNotificationSettings, null);

  return (
    <form action={action} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Bell className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-white">通知設定</h2>
      </div>
      <p className="text-sm text-zinc-500">
        アプリ内通知に加えて、Google Chat やメールでも通知を受け取れます。
      </p>

      {/* Google Chat */}
      <label className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
        <input
          type="checkbox"
          name="notifyViaChat"
          defaultChecked={notifyViaChat}
          disabled={!hasChatSpaceId}
          className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 accent-amber-500"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-white">Google Chat に転送</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            通知を Google Chat の個人スペースにも送信します。
          </p>
          {!hasChatSpaceId && (
            <p className="flex items-center gap-1 text-xs text-amber-400/70 mt-2">
              <AlertTriangle className="w-3 h-3" />
              Chat スペースIDが未設定です（管理者に設定を依頼してください）
            </p>
          )}
        </div>
      </label>

      {/* メール */}
      <label className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
        <input
          type="checkbox"
          name="notifyViaEmail"
          defaultChecked={notifyViaEmail}
          className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 accent-amber-500"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">メールに転送</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            通知をログインメールアドレス宛にも送信します。
          </p>
        </div>
      </label>

      {/* フィードバック */}
      {state?.error && (
        <p className="text-red-400 text-sm">{state.error}</p>
      )}
      {state?.success && (
        <p className="flex items-center gap-1.5 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          保存しました
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 disabled:opacity-40 transition-all"
      >
        {isPending ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
