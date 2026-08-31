"use client";

// 本部パネル: チラシ上部のビジュアル（写真）— AIで生成 ／ アップロード ／ 外す
import { useActionState, useState, useTransition } from "react";
import { Loader2, Sparkles, Upload, ImageOff, RotateCcw } from "lucide-react";
import { generateFlyerHeroImage, uploadFlyerHeroImage, deleteFlyerHeroImage } from "@/lib/actions/tver-flyer";

export interface HeroPanelProps {
  requestId: string;
  hasHero: boolean;
  heroPrompt: string | null; // 前回の生成に使ったもの
  defaultPrompt: string; // 業種×商圏から自動で作った下書き
  version: number; // 画像の再読込用（updatedAt）
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg " +
  "focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white text-zinc-900";

export function FlyerHeroPanel({ requestId, hasHero: initialHas, heroPrompt, defaultPrompt, version }: HeroPanelProps) {
  const [hasHero, setHasHero] = useState(initialHas);
  const [ver, setVer] = useState(version);
  const [prompt, setPrompt] = useState(heroPrompt ?? defaultPrompt);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [genPending, startGen] = useTransition();
  const [delPending, startDel] = useTransition();

  const boundUpload = uploadFlyerHeroImage.bind(null, requestId);
  const [upState, upAction, upPending] = useActionState(
    async (prev: { ok?: boolean; error?: string } | null, fd: FormData) => {
      const r = await boundUpload(prev, fd);
      if (r.ok) { setHasHero(true); setVer(Date.now()); setMsg({ ok: "画像を差し替えました" }); }
      return r;
    },
    null
  );

  function generate() {
    setMsg(null);
    startGen(async () => {
      const r = await generateFlyerHeroImage(requestId, prompt);
      if (r.error) setMsg({ error: r.error });
      else { setHasHero(true); setVer(Date.now()); setMsg({ ok: "画像を生成しました。右のPDF確認で仕上がりを見てください" }); }
    });
  }

  function remove() {
    setMsg(null);
    startDel(async () => {
      const r = await deleteFlyerHeroImage(requestId);
      if (r.error) setMsg({ error: r.error });
      else { setHasHero(false); setMsg({ ok: "画像を外しました（従来のイラストで出ます）" }); }
    });
  }

  const busy = genPending || upPending || delPending;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-zinc-700">上部のビジュアル（写真）</p>
        <p className="text-[11px] text-zinc-500 mt-1">
          チラシの上部に大きく入る一枚です。数字や文字は絵に入れず、HTML側で正確に出します。未設定なら従来のイラスト（家族とテレビ）で出ます。
        </p>
      </div>

      {msg?.error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{msg.error}</div>}
      {msg?.ok && <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{msg.ok}</div>}
      {upState?.error && !msg && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{upState.error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
        {/* プロンプト＋生成 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-zinc-700">描く内容（プロンプト・英語のまま送るのが最も精度が高い）</label>
            <button type="button" onClick={() => setPrompt(defaultPrompt)} disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:underline disabled:opacity-60">
              <RotateCcw className="w-3 h-3" />業種の既定に戻す
            </button>
          </div>
          <textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} className={`${inputCls} resize-y font-mono text-[12px] leading-relaxed`} />
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <button type="button" onClick={generate} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 disabled:opacity-60">
              {genPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {hasHero ? "AIで作り直す" : "AIで生成する"}
            </button>
            <span className="text-[11px] text-zinc-400">gpt-image-1・1枚 約10円・30〜60秒かかります</span>
          </div>
        </div>

        {/* 現在の画像＋アップロード */}
        <div className="space-y-2">
          <div className="aspect-[3/2] rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center">
            {hasHero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/tver-flyer/${requestId}/hero?v=${ver}`} alt="上部のビジュアル" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] text-zinc-400">未設定（従来のイラスト）</span>
            )}
          </div>
          <form action={upAction} className="flex items-center gap-2">
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required
              className="block w-full text-[11px] text-zinc-600 file:mr-2 file:px-2.5 file:py-1.5 file:rounded-md file:border file:border-zinc-200 file:bg-white file:text-[11px] file:font-semibold file:text-zinc-700 hover:file:bg-zinc-50" />
            <button type="submit" disabled={busy} title="ChatGPT等で作った画像をそのまま使う"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 whitespace-nowrap">
              {upPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              アップロード
            </button>
          </form>
          {hasHero && (
            <button type="button" onClick={remove} disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-600 hover:underline disabled:opacity-60">
              {delPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageOff className="w-3 h-3" />}
              画像を外す（イラストに戻す）
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
