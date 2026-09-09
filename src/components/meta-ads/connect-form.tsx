"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveMetaAdAccount, disconnectMetaAdAccount } from "@/lib/actions/meta-ads";

type Props = { existing: { name: string; adAccountId: string; pageId: string } | null };

/** Meta広告アカウントの接続フォーム（拠点ごと・トークンは保存後に表示しない） */
export function MetaConnectForm({ existing }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    start(async () => {
      const r = await saveMetaAdAccount(null, fd);
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: r.message ?? "保存しました" });
        router.refresh();
      }
    });
  };
  const onDisconnect = () => {
    if (!confirm("接続を解除します。作成済みの広告はMeta側に残ります。よろしいですか？")) return;
    start(async () => {
      const r = await disconnectMetaAdAccount();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: r.message ?? "解除しました" });
      router.refresh();
    });
  };

  const input = "w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-300";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1">表示名</label>
        <input name="name" defaultValue={existing?.name ?? ""} placeholder="例: 佐賀 ○○社" className={input} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">広告アカウントID</label>
          <input name="adAccountId" defaultValue={existing?.adAccountId ?? ""} placeholder="act_1234567890" className={input} required />
          <p className="text-[11px] text-zinc-400 mt-1">広告マネージャ → 設定 → 広告アカウントID</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1">FacebookページID</label>
          <input name="pageId" defaultValue={existing?.pageId ?? ""} placeholder="1234567890" className={input} required />
          <p className="text-[11px] text-zinc-400 mt-1">広告の名義になるページ。ページの「基本データ」に表示</p>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1">アクセストークン{existing ? "（変更する時だけ）" : ""}</label>
        <input name="accessToken" type="password" autoComplete="off" placeholder={existing ? "保存済み（空欄のままで維持）" : "EAAB…（Meta Business のシステムユーザー・ads_management 権限）"} className={input} />
        <p className="text-[11px] text-zinc-400 mt-1">保存時に接続テストをします。トークンは暗号化して保存し、画面には二度と表示しません。</p>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-zinc-900 font-semibold text-sm px-4 py-2 rounded-lg disabled:opacity-60">
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {existing ? "更新して接続テスト" : "接続テストして保存"}
        </button>
        {existing && (
          <button type="button" onClick={onDisconnect} disabled={pending} className="text-sm text-zinc-500 hover:text-rose-700 underline">
            接続を解除
          </button>
        )}
      </div>
    </form>
  );
}
