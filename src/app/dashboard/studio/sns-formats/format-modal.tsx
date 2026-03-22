"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { type SnsFormat, OVERLAYS } from "./format-data";
import { SHOOT_TIPS, SHOOT_MAP } from "./shoot-data";

export function FormatModal({ format: f, onClose, userId, branchId, clients }: {
  format: SnsFormat;
  onClose: () => void;
  userId: string;
  branchId: string;
  clients: { id: string; name: string; businessType: string }[];
}) {
  const [selectedTelop, setSelectedTelop] = useState(f.rtlp);
  const [selectedClient, setSelectedClient] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string } | null>(null);
  const ov = OVERLAYS[f.ind] || OVERLAYS.general;

  async function handleOrder() {
    setOrdering(true);
    setOrderResult(null);
    try {
      const res = await fetch("/api/studio/sns-formats/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatId: f.id,
          formatName: f.nm,
          telopId: selectedTelop,
          industry: f.ind,
          taste: f.taste,
          duration: f.dur,
          platforms: f.pf.join(","),
          structure: f.st,
          studioClientId: selectedClient || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrderResult({ success: true, message: `依頼を受け付けました（ID: ${data.id}）` });
      } else {
        setOrderResult({ success: false, message: data.error || "エラーが発生しました" });
      }
    } catch {
      setOrderResult({ success: false, message: "通信エラー" });
    } finally {
      setOrdering(false);
    }
  }

  function copyShootGuide() {
    const tips = SHOOT_TIPS[f.ind] || SHOOT_TIPS.general;
    const common = SHOOT_TIPS._common;
    const pid = f.id.split("_").slice(1, -1).join("_");
    const keys = SHOOT_MAP[pid] || ["space", "staff"];

    let t = `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `📋 撮影依頼書\n`;
    t += `${f.nm}（${f.dur}）\n`;
    t += `フォーマットID: ${f.id}\n`;
    t += `配信先: ${f.pf.join(" / ").toUpperCase()}\n`;
    t += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    t += `【基本ルール】\n`;
    Object.values(common).forEach((v) => { t += `・${v}\n`; });
    t += `\n【撮影カット】\n`;
    f.st.forEach((s, i) => {
      const mk = keys[i % keys.length];
      const tip = (tips as any)[mk] || "";
      t += `${i + 1}. ${s.l}（${s.d}）\n`;
      if (tip) t += `   → ${tip}\n`;
      t += `\n`;
    });
    t += `━━━━━━━━━━━━━━━━━━━━━━━━━━\nAd Arch Group / SNS Format Studio\n`;

    navigator.clipboard.writeText(t);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Preview header */}
        <div className="h-56 relative overflow-hidden rounded-t-2xl">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${f.img})` }} />
          <div className="absolute inset-0" style={{ background: ov }} />
          <button onClick={onClose} className="absolute top-4 right-4 z-20 w-8 h-8 bg-black/30 backdrop-blur rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-black/50 transition">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute left-8 bottom-8 z-10 max-w-[50%]">
            <div className="text-2xl font-bold text-white drop-shadow-lg">{f.nm}</div>
            <p className="text-sm text-white/60 mt-1">{f.desc}</p>
            <div className="flex gap-1.5 mt-3">
              {f.tags.map(([label, cls], i) => (
                <span key={i} className="text-xs text-white/80 bg-white/10 backdrop-blur px-2.5 py-1 rounded">{label}</span>
              ))}
            </div>
          </div>
          {/* Phone */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 w-[130px] h-[232px] bg-black border-2 border-white/15 rounded-2xl overflow-hidden shadow-2xl z-10">
            <img src={f.pimg} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
            <div className="absolute bottom-6 left-2 right-2 text-center z-10" ref={(el) => { if (el) el.style.cssText = f.ptcss + ";font-size:14px"; }}>{f.pt}</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="text-lg font-bold text-zinc-900">{f.nm}</div>
            <div className="text-sm text-zinc-400">{f.dur} ・ {f.pf.join(" / ").toUpperCase()}</div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">構成タイムライン</h3>
            <div className="flex gap-0.5 rounded-lg overflow-hidden h-12">
              {f.st.map((s, i) => (
                <div key={i} className="flex flex-col items-center justify-center px-2" style={{ flex: parseFloat(s.d), background: s.c }}>
                  <span className="text-[10px] font-semibold text-white/90 whitespace-nowrap">{s.l}</span>
                  <span className="text-[9px] text-white/50">{s.d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Telop selector */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">テロップスタイル</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {f.telops.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTelop(t)}
                  className={`p-3 rounded-lg border text-xs text-center transition ${selectedTelop === t
                    ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 font-medium shadow-sm"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Shoot guide */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">撮影依頼書</h3>
            <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-4 space-y-2">
              {f.st.map((s, i) => {
                const tips = SHOOT_TIPS[f.ind] || SHOOT_TIPS.general;
                const pid = f.id.split("_").slice(1, -1).join("_");
                const keys = SHOOT_MAP[pid] || ["space", "staff"];
                const mk = keys[i % keys.length];
                const tip = (tips as any)[mk] || "";
                return (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="font-bold text-fuchsia-600 w-5 shrink-0">{i + 1}</span>
                    <div>
                      <span className="font-semibold text-zinc-900">{s.l}（{s.d}）</span>
                      {tip && <p className="text-zinc-500 mt-0.5">{tip}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={copyShootGuide} className="mt-2 text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium">
              📋 撮影依頼書をコピー
            </button>
          </div>

          {/* Order section */}
          <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-5">
            <h3 className="font-bold text-zinc-900 mb-3">このフォーマットで制作する</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">クライアント（任意）</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">選択なし</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}（{c.businessType}）</option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-zinc-400">
                選択中: {f.nm} / テロップ: {selectedTelop} / {f.dur}
              </div>
              {orderResult && (
                <div className={`text-sm p-3 rounded-lg ${orderResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {orderResult.message}
                </div>
              )}
              <button
                onClick={handleOrder}
                disabled={ordering}
                className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-semibold py-3 rounded-xl hover:from-fuchsia-700 hover:to-purple-700 transition disabled:opacity-50"
              >
                {ordering ? "送信中..." : "この構成で依頼する"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
