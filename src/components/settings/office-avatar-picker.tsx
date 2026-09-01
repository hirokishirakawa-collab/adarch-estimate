"use client";
// 設定画面: グループオフィスの顔アイコンを選ぶ（24種＋Googleの写真）
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateOfficeAvatar } from "@/lib/actions/office-avatar";

const IDS = Array.from({ length: 24 }, (_, i) => `a${String(i + 1).padStart(2, "0")}`);

export function OfficeAvatarPicker({ current, googleImage }: { current: string | null; googleImage: string | null }) {
  const [sel, setSel] = useState<string | null>(current);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const choose = (id: string | null) => {
    setSel(id);
    setSaved(false);
    setErr(null);
    start(async () => {
      const r = await updateOfficeAvatar(id);
      if (r.error) setErr(r.error);
      else setSaved(true);
    });
  };

  return (
    <div>
      <h2 className="text-base font-bold text-white">グループオフィスの顔</h2>
      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
        グループライブの地図・チャット・ひとことに出るアイコンです。押すとすぐ保存されます。
      </p>

      <div className="mt-4 grid grid-cols-6 sm:grid-cols-8 gap-2.5">
        {IDS.map((id) => {
          const on = sel === id;
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={() => choose(id)}
              className={`relative aspect-square rounded-full overflow-hidden transition ring-offset-2 ring-offset-zinc-900 ${
                on ? "ring-2 ring-emerald-400 scale-105" : "hover:ring-2 hover:ring-zinc-500"
              }`}
              aria-label={`アイコン ${id}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/office/avatars/${id}.webp`} alt="" className="w-full h-full object-cover bg-[#f6f1e7]" />
              {on && (
                <span className="absolute inset-0 flex items-end justify-end p-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 bg-zinc-900 rounded-full" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled={pending}
          onClick={() => choose(null)}
          className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-xs transition ${
            sel === null ? "border-emerald-400 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
        >
          {googleImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={googleImage} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <span className="w-6 h-6 rounded-full bg-zinc-700" />
          )}
          Google の写真を使う
        </button>
        {saved && <span className="text-xs text-emerald-400">保存しました</span>}
        {err && <span className="text-xs text-rose-400">{err}</span>}
      </div>
    </div>
  );
}
