"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, CalendarCheck, Link2 } from "lucide-react";
import { saveLineBookingType, deleteLineBookingType, getLineHostConnectUrl, saveLineBookingReminder } from "@/lib/actions/line-booking";

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const labelCls = "block text-[11px] font-bold text-zinc-500 mb-1";
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

export type BookingTypeDef = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  days: number[];
  start: string;
  end: string;
  maxDaysAhead: number;
  minNoticeHours: number;
  isActive: boolean;
  own: boolean; // この拠点が作った枠（編集可）
  upcoming: number;
};

function TypeForm({ accountId, initial, onClose }: { accountId: string; initial?: BookingTypeDef; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit(fd: FormData) {
    startTransition(async () => {
      const r = await saveLineBookingType(null, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }
  return (
    <form action={submit} className="bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
      <input type="hidden" name="accountId" value={accountId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid sm:grid-cols-[1fr_160px_120px] gap-2">
        <div>
          <label className={labelCls}>枠の名前（相手に見えます）</label>
          <input name="title" defaultValue={initial?.title ?? ""} placeholder="例: ご相談（30分）" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>URL名（英数字・後から変えられません）</label>
          <input name="slug" defaultValue={initial?.slug ?? ""} placeholder="例: soudan" className={inputCls} disabled={!!initial} />
        </div>
        <div>
          <label className={labelCls}>所要時間（分）</label>
          <input name="durationMinutes" type="number" min={15} max={240} step={15} defaultValue={initial?.durationMinutes ?? 30} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>説明（任意）</label>
        <textarea name="description" rows={2} defaultValue={initial?.description ?? ""} className={inputCls} />
      </div>
      <div className="grid sm:grid-cols-[1fr_110px_110px_120px_120px] gap-2 items-end">
        <div>
          <label className={labelCls}>受付する曜日</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d, i) => (
              <label key={i} className="text-xs text-zinc-700 flex items-center gap-1">
                <input type="checkbox" name="days" value={i} defaultChecked={(initial?.days ?? [1, 2, 3, 4, 5]).includes(i)} />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>開始</label>
          <input name="start" type="time" defaultValue={initial?.start ?? "10:00"} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>終了</label>
          <input name="end" type="time" defaultValue={initial?.end ?? "18:00"} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>何日先まで</label>
          <input name="maxDaysAhead" type="number" min={3} max={60} defaultValue={initial?.maxDaysAhead ?? 14} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>直前は何時間前まで</label>
          <input name="minNoticeHours" type="number" min={1} max={168} defaultValue={initial?.minNoticeHours ?? 24} className={inputCls} />
        </div>
      </div>
      <label className="text-xs text-zinc-700 flex items-center gap-1.5">
        <input type="checkbox" name="isActive" value="on" defaultChecked={initial?.isActive ?? true} />受付中
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200">やめる</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-1 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
          {isPending && <Loader2 className="w-3 h-3 animate-spin" />}保存
        </button>
      </div>
    </form>
  );
}

export function BookingManager({
  accountId,
  isHq,
  types,
  host,
  reminderText,
}: {
  accountId: string;
  isHq: boolean;
  types: BookingTypeDef[];
  host: { name: string; email: string; connected: boolean } | null;
  reminderText: string | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl border border-zinc-200 p-4 space-y-2">
        <p className="text-sm font-bold text-zinc-900 flex items-center gap-1.5"><Link2 className="w-4 h-4 text-emerald-700" />Googleカレンダーの接続（担当者）</p>
        {host ? (
          <p className="text-xs text-zinc-700">
            {host.name}（{host.email}）：{host.connected ? <span className="text-emerald-700 font-bold">接続済</span> : <span className="text-amber-700 font-bold">未接続</span>}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">まだ担当者が登録されていません。枠を作ると自動で登録されます。</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { const r = await getLineHostConnectUrl(accountId); if (r.error) setMsg(r.error); else setConnectUrl(r.url ?? null); })}
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 hover:bg-zinc-50"
          >
            {host?.connected ? "接続をやり直すリンクを発行" : "接続リンクを発行"}
          </button>
          {connectUrl && (
            <a href={connectUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline break-all">{connectUrl}</a>
          )}
        </div>
        <p className="text-[11px] text-zinc-400">リンクを開いてGoogleアカウントで許可すると、空き時間の照会とMeet付き予定の作成ができるようになります。</p>
        {msg && <p className="text-[11px] text-red-600">{msg}</p>}
      </section>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-zinc-500">
          本文に <code className="bg-zinc-100 rounded px-1">{"{book:URL名}"}</code> と書くと相手ごとの予約URLに置き換わり、予約が入ると自動でその友だちに紐づきます（タグ <code className="bg-zinc-100 rounded px-1">予約済</code>・チャットに記録・通知・前日リマインド）。
        </p>
        {!isHq && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-3.5 h-3.5" />予約枠を作る
          </button>
        )}
      </div>
      {isHq && <p className="text-[11px] text-zinc-400">本部の枠は「管理 → 商談予約」で管理します（ここでは一覧と利用のみ）。</p>}
      {adding && <TypeForm accountId={accountId} onClose={() => setAdding(false)} />}

      {types.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">まだ予約枠はありません。</div>
      ) : (
        <div className="space-y-2">
          {types.map((t) =>
            editing === t.id ? (
              <TypeForm key={t.id} accountId={accountId} initial={t} onClose={() => setEditing(null)} />
            ) : (
              <div key={t.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex items-start gap-3">
                <CalendarCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-900">
                    {t.title} <code className="ml-1 text-[10px] bg-zinc-100 rounded px-1 font-normal">{`{book:${t.slug}}`}</code>
                    <span className={`ml-2 text-[10px] rounded px-1 ${t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{t.isActive ? "受付中" : "停止"}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {t.durationMinutes}分 ・ {t.days.map((d) => DAYS[d]).join("")} {t.start}〜{t.end} ・ {t.maxDaysAhead}日先まで ・ 今後の予約 {t.upcoming}件
                  </p>
                </div>
                {t.own && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => setEditing(t.id)} className="text-[11px] text-zinc-500 hover:text-zinc-900">編集</button>
                    <button type="button" disabled={isPending} onClick={() => startTransition(async () => { const r = await deleteLineBookingType(accountId, t.id); setMsg(r.error ?? null); router.refresh(); })} className="text-[11px] text-zinc-400 hover:text-red-600">削除</button>
                  </span>
                )}
              </div>
            ),
          )}
        </div>
      )}

      <section className="bg-white rounded-xl border border-zinc-200 p-4">
        <form
          action={(fd) => startTransition(async () => { const r = await saveLineBookingReminder(null, fd); setMsg(r.error ?? (r.message ?? "保存しました")); })}
          className="space-y-2"
        >
          <input type="hidden" name="accountId" value={accountId} />
          <label className={labelCls}>前日リマインドの文面（空なら既定文・{"{time}"} {"{title}"} {"{meet}"} {"{name}"} が使えます）</label>
          <textarea name="bookingReminderText" rows={3} defaultValue={reminderText ?? ""} className={inputCls} placeholder={"明日 {time} からのご予約のリマインドです。\n{title}\n{meet}\n\n当日はどうぞよろしくお願いいたします。"} />
          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-800 text-white disabled:opacity-50">保存</button>
          </div>
        </form>
      </section>
    </div>
  );
}
