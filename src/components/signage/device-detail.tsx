"use client";
// 端末詳細: 基本情報の編集・スケジュール（プレイリスト割当）・直近7日の再生
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2, Wifi, WifiOff } from "lucide-react";
import { btnDanger, btnGhost, btnPrimary, fmtAgo, input, label } from "./shared";

type Schedule = { id: string; name: string; playlistId: string; daysOfWeek: number[]; startTime: string | null; endTime: string | null; startDate: string | null; endDate: string | null; priority: number; isActive: boolean; playlist: { id: string; name: string } };
type Device = {
  id: string; name: string; locationName: string | null; address: string | null; notes: string | null; orientation: "LANDSCAPE" | "PORTRAIT"; pollSec: number;
  lastSeenAt: string | null; lastDownloadAt: string | null; manifestVersion: number; appVersion: string | null; storageUsedMb: number | null; storageTotalMb: number | null; playingAssetId: string | null;
  branch: { id: string; name: string } | null; customer: { id: string; name: string } | null; schedules: Schedule[];
  plays7d: { assetId: string; count: number; seconds: number }[];
  online?: boolean;
};
type Playlist = { id: string; name: string; _count: { items: number } };
const DOW = ["日", "月", "火", "水", "木", "金", "土"];

export function DeviceDetail({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [d, setD] = useState<Device | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [form, setForm] = useState({ name: "", locationName: "", address: "", notes: "", orientation: "LANDSCAPE" as "LANDSCAPE" | "PORTRAIT", pollSec: 60 });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([fetch(`/api/signage/devices/${deviceId}`, { cache: "no-store" }), fetch("/api/signage/playlists", { cache: "no-store" })]);
    if (!r1.ok) { toast.error("端末が見つかりません"); return; }
    const j: Device = await r1.json();
    j.online = !!j.lastSeenAt && Date.now() - Date.parse(j.lastSeenAt) < Math.max(j.pollSec * 3, 300) * 1000;
    setD(j);
    setForm({ name: j.name, locationName: j.locationName ?? "", address: j.address ?? "", notes: j.notes ?? "", orientation: j.orientation, pollSec: j.pollSec });
    if (r2.ok) setPlaylists(await r2.json());
  }, [deviceId]);
  useEffect(() => { void Promise.resolve().then(load); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const saveBasics = async () => {
    const r = await fetch(`/api/signage/devices/${deviceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (r.ok) { toast.success("保存しました"); load(); } else toast.error("保存に失敗しました");
  };
  const removeDevice = async () => {
    if (!confirm("この端末を無効化しますか？端末側はペアリング待ちに戻ります（再生ログは残ります）")) return;
    const r = await fetch(`/api/signage/devices/${deviceId}`, { method: "DELETE" });
    if (r.ok) { toast.success("無効化しました"); router.push("/dashboard/signage"); } else toast.error("失敗しました");
  };
  const delSchedule = async (s: Schedule) => {
    const r = await fetch(`/api/signage/schedules/${s.id}`, { method: "DELETE" });
    if (r.ok) { toast.success("外しました"); load(); } else toast.error("失敗しました");
  };

  if (!d) return <p className="text-sm text-zinc-400 py-8 text-center">読み込み中…</p>;
  const online = !!d.online;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* スケジュール */}
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-900 text-sm">放映スケジュール</h3>
            <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" />プレイリストを割り当て</button>
          </div>
          {d.schedules.length === 0 ? (
            <p className="text-sm text-red-600">未設定＝端末は黒画面です。まず「標準」（条件なし）を割り当ててください</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {d.schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm text-zinc-900">{s.name} → <b>{s.playlist.name}</b>{!s.isActive && <span className="ml-2 text-xs text-zinc-400">（停止中）</span>}</div>
                    <div className="text-xs text-zinc-500">
                      {s.daysOfWeek.length === 0 ? "毎日" : s.daysOfWeek.map((n) => DOW[n]).join("")}・{s.startTime || s.endTime ? `${s.startTime ?? "0:00"}〜${s.endTime ?? "24:00"}` : "終日"}
                      {s.startDate || s.endDate ? `・${(s.startDate ?? "").slice(0, 10)}〜${(s.endDate ?? "").slice(0, 10)}` : ""}・優先度{s.priority}
                    </div>
                  </div>
                  <button className={btnDanger} onClick={() => delSchedule(s)}><Trash2 className="w-3 h-3" />外す</button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-zinc-400 mt-2">複数ある場合は「優先度が高く、条件に合う」ものが流れます。条件なし・優先度0を「標準」として1本置くのが基本です。</p>
        </section>

        {/* 基本情報 */}
        <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-zinc-900 text-sm">端末情報</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className={label}>端末名</label><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className={label}>設置先名</label><input className={input} value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={label}>住所</label><input className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div>
              <label className={label}>向き</label>
              <select className={input} value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value as "LANDSCAPE" | "PORTRAIT" })}><option value="LANDSCAPE">横</option><option value="PORTRAIT">縦</option></select>
            </div>
            <div><label className={label}>問い合わせ間隔（秒）</label><input type="number" min={15} max={3600} className={input} value={form.pollSec} onChange={(e) => setForm({ ...form, pollSec: Number(e.target.value) })} /></div>
            <div className="md:col-span-2"><label className={label}>メモ（設置条件・電源・Wi-Fi等）</label><textarea className={input} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex justify-between">
            <button className={btnDanger} onClick={removeDevice}><Trash2 className="w-3 h-3" />端末を無効化</button>
            <button className={btnPrimary} onClick={saveBasics}><Save className="w-3.5 h-3.5" />保存</button>
          </div>
        </section>
      </div>

      {/* 右: 動作状況・再生 */}
      <aside className="space-y-4">
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-zinc-900 text-sm">動作状況</h3>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${online ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}{online ? "オンライン" : "オフライン"}</span>
          </div>
          <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-zinc-400">拠点</dt><dd>{d.branch?.name ?? "本部"}</dd>
            <dt className="text-zinc-400">設置先</dt><dd>{d.customer?.name ?? d.locationName ?? "—"}</dd>
            <dt className="text-zinc-400">最終アクセス</dt><dd>{fmtAgo(d.lastSeenAt)}</dd>
            <dt className="text-zinc-400">最終ダウンロード</dt><dd>{fmtAgo(d.lastDownloadAt)}</dd>
            <dt className="text-zinc-400">版</dt><dd>v{d.manifestVersion}</dd>
            <dt className="text-zinc-400">プレイヤー</dt><dd>{d.appVersion ?? "—"}</dd>
            <dt className="text-zinc-400">ストレージ</dt><dd>{d.storageUsedMb != null ? `${d.storageUsedMb} MB${d.storageTotalMb ? ` / ${Math.round(d.storageTotalMb / 1024)} GB` : ""}` : "—"}</dd>
          </dl>
        </section>
        <section className="bg-white border border-zinc-200 rounded-xl p-4">
          <h3 className="font-bold text-zinc-900 text-sm mb-2">直近7日の再生（放映証明の元）</h3>
          {d.plays7d.length === 0 ? <p className="text-xs text-zinc-400">まだ再生ログがありません</p> : (
            <ul className="text-xs space-y-1">
              {d.plays7d.map((p) => <li key={p.assetId} className="flex justify-between"><span className="truncate text-zinc-600">{p.assetId.slice(-6)}</span><span>{p.count}回・{Math.round(p.seconds / 60)}分</span></li>)}
            </ul>
          )}
        </section>
      </aside>

      {adding && <AddScheduleDialog deviceId={deviceId} playlists={playlists} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function AddScheduleDialog({ deviceId, playlists, onClose, onDone }: { deviceId: string; playlists: Playlist[]; onClose: () => void; onDone: () => void }) {
  const [playlistId, setPlaylistId] = useState(playlists[0]?.id ?? "");
  const [name, setName] = useState("標準");
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState(0);

  const submit = async () => {
    if (!playlistId) { toast.error("プレイリストを選んでください（先にプレイリストを作成）"); return; }
    const r = await fetch("/api/signage/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, playlistId, name, daysOfWeek: days, startTime: startTime || null, endTime: endTime || null, startDate: startDate || null, endDate: endDate ? `${endDate}T23:59:59` : null, priority }) });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "失敗しました"); return; }
    toast.success("割り当てました"); onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-zinc-900">プレイリストを割り当て</h3>
        <div><label className={label}>プレイリスト</label>
          <select className={input} value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
            {playlists.length === 0 && <option value="">（プレイリストがありません）</option>}
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}（{p._count.items}枠）</option>)}
          </select></div>
        <div><label className={label}>スケジュール名</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className={label}>曜日（未選択＝毎日）</label>
          <div className="flex gap-1">{DOW.map((w, i) => <button key={i} type="button" className={`w-9 h-9 rounded-lg text-sm border ${days.includes(i) ? "bg-orange-600 text-white border-orange-600" : "bg-white border-zinc-200 text-zinc-600"}`} onClick={() => setDays((a) => a.includes(i) ? a.filter((x) => x !== i) : [...a, i].sort())}>{w}</button>)}</div></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>開始時刻（空＝終日）</label><input type="time" className={input} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div><label className={label}>終了時刻</label><input type="time" className={input} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          <div><label className={label}>開始日（空＝無期限）</label><input type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><label className={label}>終了日</label><input type="date" className={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div><label className={label}>優先度（大きいほど優先）</label><input type="number" className={input} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-1"><button className={btnGhost} onClick={onClose}>キャンセル</button><button className={btnPrimary} onClick={submit}>割り当てる</button></div>
      </div>
    </div>
  );
}
