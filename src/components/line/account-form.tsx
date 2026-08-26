"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { saveLineAccount } from "@/lib/actions/line";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const labelCls = "block text-[11px] font-bold text-zinc-500 mb-1";

type Props = {
  account?: {
    id: string;
    name: string;
    channelId: string;
    greetingText: string | null;
    autoReplyText: string | null;
    conversionTag?: string | null;
  };
  /** 新規のときの見出し（本部 or 拠点名） */
  ownerLabel: string;
  collapsible?: boolean;
};

// ---------------------------------------------------------------
// LINE公式アカウントの接続フォーム（新規＝3つの値を貼る／編集＝空欄なら据え置き）
// ---------------------------------------------------------------
export function AccountForm({ account, ownerLabel, collapsible = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(!collapsible);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isNew = !account;

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await saveLineAccount(null, formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setDone(true);
      if (isNew && res.id) router.push(`/dashboard/line/${res.id}/settings`);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        LINE公式アカウントを接続する
      </button>
    );
  }

  return (
    <form action={submit} className="w-full bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-900">
          {isNew ? `LINE公式アカウントを接続（${ownerLabel}）` : "接続設定"}
        </p>
        {collapsible && (
          <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {account && <input type="hidden" name="id" value={account.id} />}

      <div>
        <label className={labelCls}>表示名（OS内での呼び名）</label>
        <input name="name" defaultValue={account?.name ?? ""} required placeholder="例: 本部 加盟促進" className={inputCls} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>チャネルID{!isNew && "（変更時のみ）"}</label>
          <input name="channelId" defaultValue={account?.channelId ?? ""} className={inputCls} autoComplete="off" />
        </div>
        <div>
          <label className={labelCls}>チャネルシークレット{!isNew && "（変更時のみ）"}</label>
          <input name="channelSecret" type="password" className={inputCls} autoComplete="off" />
        </div>
      </div>
      <div>
        <label className={labelCls}>チャネルアクセストークン（長期）{!isNew && "（変更時のみ）"}</label>
        <input name="accessToken" type="password" className={inputCls} autoComplete="off" />
        <p className="text-[11px] text-zinc-400 mt-1">
          LINE Developers → 該当チャネル → Messaging API設定 で発行。保存時に接続テストを行います。
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>友だち追加時のあいさつ（空なら送らない）</label>
          <textarea name="greetingText" rows={4} defaultValue={account?.greetingText ?? ""} className={inputCls} placeholder="{name} で相手の表示名を差し込めます" />
        </div>
        <div>
          <label className={labelCls}>メッセージ受信時の自動返信（空なら送らない）</label>
          <textarea name="autoReplyText" rows={4} defaultValue={account?.autoReplyText ?? ""} className={inputCls} placeholder="例: ありがとうございます。担当より順にお返事します。" />
        </div>
      </div>

      {!isNew && (
        <div>
          <label className={labelCls}>成約とみなすタグ（CV管理の「成約」列に使う・空なら「成約」）</label>
          <input name="conversionTag" defaultValue={account?.conversionTag ?? ""} placeholder="成約" className={inputCls} />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && !isNew && <p className="text-xs text-emerald-700">保存しました</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isNew ? "接続する" : "保存"}
        </button>
      </div>
    </form>
  );
}
