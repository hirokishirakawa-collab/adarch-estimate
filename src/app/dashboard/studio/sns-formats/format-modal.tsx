"use client";

import { useState } from "react";
import { X, Copy, Check, FileText, Terminal } from "lucide-react";
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
  const [copiedShoot, setCopiedShoot] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const ov = OVERLAYS[f.ind] || OVERLAYS.general;

  // 撮影依頼書テキスト生成
  function genShootText() {
    const tips = SHOOT_TIPS[f.ind] || SHOOT_TIPS.general;
    const common = SHOOT_TIPS._common;
    const pid = f.id.split("_").slice(1, -1).join("_");
    const keys = SHOOT_MAP[pid] || ["space", "staff"];

    let t = `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `📋 撮影依頼書\n`;
    t += `${f.nm}（${f.dur}）\n`;
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
    });
    t += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    t += `Ad Arch Group / SNS Format Studio\n`;
    return t;
  }

  // Claude実行コマンド生成
  function genClaudeCommand() {
    const structure = f.st.map((s) => `${s.l}(${s.d})`).join(" → ");
    return `SNSフォーマット自動編集を実行してください。

【フォーマット情報】
・名前: ${f.nm}
・ID: ${f.id}
・業種: ${f.ind}
・尺: ${f.dur}
・配信先: ${f.pf.join(", ")}
・構成: ${structure}
・テロップスタイル: ${selectedTelop}

【実行手順】
1. 素材フォルダ内のメディアをPremiere Proにインポート
2. シーケンス「${f.nm}」を作成
3. 以下の構成でクリップを配置:
${f.st.map((s, i) => `   ${i + 1}. ${s.l} — ${s.d}`).join("\n")}
4. テロップスタイル「${selectedTelop}」でテロップを配置
5. マーカーを各セクション区切りに追加
6. BGMを配置

素材フォルダ: （ここに素材パスを入力）`;
  }

  function copyShoot() {
    navigator.clipboard.writeText(genShootText());
    setCopiedShoot(true);
    setTimeout(() => setCopiedShoot(false), 2000);
  }

  function copyCommand() {
    navigator.clipboard.writeText(genClaudeCommand());
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
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

          {/* ━━━ 撮影依頼書（クライアント向け） ━━━ */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              <FileText className="w-3 h-3 inline mr-1" />
              撮影依頼書（クライアントに渡す）
            </h3>
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
            <button
              onClick={copyShoot}
              className="mt-2 flex items-center gap-1.5 text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium transition"
            >
              {copiedShoot ? <><Check className="w-3 h-3" /> コピーしました</> : <><Copy className="w-3 h-3" /> 撮影依頼書をコピー</>}
            </button>
          </div>

          {/* ━━━ 制作コマンド（Claude実行用） ━━━ */}
          <div className="bg-zinc-900 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">制作コマンド（Claudeに貼り付け）</h3>
            </div>
            <p className="text-xs text-zinc-400">
              以下をコピーして、Premiere連携済みの Claude に貼り付けると自動編集が実行されます。
              素材フォルダのパスだけ書き換えてください。
            </p>
            <div className="bg-black/50 rounded-lg p-4 font-mono text-xs text-emerald-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
              {genClaudeCommand()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyCommand}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2 ${
                  copiedCmd
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-500 text-white hover:bg-emerald-400"
                }`}
              >
                {copiedCmd ? <><Check className="w-4 h-4" /> コピー済み</> : <><Copy className="w-4 h-4" /> 制作コマンドをコピー</>}
              </button>
            </div>
            <div className="text-[10px] text-zinc-500 leading-relaxed">
              💡 コピー後、Claude Code で貼り付け → 素材パスを指定 → 自動でPremiere Proが編集を実行します。API費用はかかりません。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
