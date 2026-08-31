"use client";
// 端末一覧＋動作状況＋端末追加（ペアリングコード入力）
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { CustomerPicker, btnGhost, btnPrimary, fmtAgo, input, label } from "./shared";

type Device = {
  id: string; name: string; locationName: string | null; orientation: "LANDSCAPE" | "PORTRAIT";
  lastSeenAt: string | null; lastDownloadAt: string | null; manifestVersion: number; appVersion: string | null;
  storageUsedMb: number | null; storageTotalMb: number | null; online: boolean;
  branch: { id: string; name: string } | null; customer: { id: string; name: string } | null;
  schedules: { id: string; name: string; playlist: { id: string; name: string; _count: { items: number } } }[];
};

export function DeviceList({ role, playerUrl, branches }: { role: string; playerUrl: string; branches: { id: string; name: string }[] }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/signage/devices", { cache: "no-store" });
    if (r.ok) setDevices(await r.json());
  }, []);
  useEffect(() => { void Promise.resolve().then(load); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-500">30秒ごとに自動更新。端末は{`約${Math.max(3, 3)}回`}の問い合わせ間隔（既定3分）を超えて応答がないとオフライン表示になります</p>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={load}><RefreshCw className="w-3.5 h-3.5" />更新</button>
          <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" />端末を追加</button>
        </div>
      </div>

      {devices === null ? (
        <p className="text-sm text-zinc-400 py-8 text-center">読み込み中…</p>
      ) : devices.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-300 rounded-xl p-8 text-center text-sm text-zinc-500">
          端末がまだありません。「端末を追加」から、端末画面に出ている6桁コードを入力してください。
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => (
            <Link key={d.id} href={`/dashboard/signage/devices/${d.id}`} className="block bg-white border border-zinc-200 rounded-xl p-4 hover:border-orange-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-900">{d.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{[d.branch?.name, d.locationName ?? d.customer?.name].filter(Boolean).join("／") || "—"}</div>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${d.online ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {d.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}{d.online ? "オンライン" : "オフライン"}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-xs">
                <dt className="text-zinc-400">最終アクセス</dt><dd className="text-zinc-700">{fmtAgo(d.lastSeenAt)}</dd>
                <dt className="text-zinc-400">最終ダウンロード</dt><dd className="text-zinc-700">{fmtAgo(d.lastDownloadAt)}</dd>
                <dt className="text-zinc-400">版／プレイヤー</dt><dd className="text-zinc-700">v{d.manifestVersion}{d.appVersion ? ` / ${d.appVersion}` : ""}</dd>
                <dt className="text-zinc-400">放映中</dt><dd className="text-zinc-700">{d.schedules[0] ? `${d.schedules[0].playlist.name}（${d.schedules[0].playlist._count.items}枠）` : <span className="text-red-600">未設定</span>}</dd>
              </dl>
            </Link>
          ))}
        </div>
      )}

      {adding && <AddDeviceDialog role={role} playerUrl={playerUrl} branches={branches} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function AddDeviceDialog({ role, playerUrl, branches, onClose, onDone }: { role: string; playerUrl: string; branches: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [orientation, setOrientation] = useState<"LANDSCAPE" | "PORTRAIT">("LANDSCAPE");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (code.replace(/\D/g, "").length !== 6) { toast.error("6桁のコードを入力してください"); return; }
    if (!name.trim()) { toast.error("端末名を入力してください"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/signage/devices/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name, locationName, orientation, customerId: customer?.id ?? null, branchId: branchId || null }) });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? "登録に失敗しました"); return; }
      toast.success("端末を登録しました。数十秒以内に再生が始まります");
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-zinc-900">端末を追加</h3>
        <ol className="text-xs text-zinc-600 list-decimal pl-4 space-y-1 bg-zinc-50 rounded-lg p-3">
          <li>端末（TVスティック等）のブラウザで <code className="bg-white px-1 rounded border">{playerUrl}</code> を開く</li>
          <li>画面に出る <b>6桁のペアリングコード</b> を下に入力する</li>
          <li>登録すると端末は自動で再生を始めます（プレイリストは端末詳細で割り当て）</li>
        </ol>
        <div>
          <label className={label}>ペアリングコード</label>
          <input className={`${input} text-2xl tracking-[0.3em] font-mono text-center`} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>端末名（必須）</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山口井筒屋エントランス" /></div>
          <div><label className={label}>設置先名</label><input className={input} value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="例: 山口井筒屋 1F" /></div>
          <div>
            <label className={label}>向き</label>
            <select className={input} value={orientation} onChange={(e) => setOrientation(e.target.value as "LANDSCAPE" | "PORTRAIT")}>
              <option value="LANDSCAPE">横（ランドスケープ）</option>
              <option value="PORTRAIT">縦（ポートレート）</option>
            </select>
          </div>
          {role === "ADMIN" && (
            <div>
              <label className={label}>拠点</label>
              <select className={input} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">本部</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div><label className={label}>設置先（顧客DB・任意）</label><CustomerPicker value={customer} onChange={setCustomer} placeholder="設置先の会社名で検索" /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btnGhost} onClick={onClose}>キャンセル</button>
          <button className={btnPrimary} onClick={submit} disabled={busy}>{busy ? "登録中…" : "登録する"}</button>
        </div>
      </div>
    </div>
  );
}
