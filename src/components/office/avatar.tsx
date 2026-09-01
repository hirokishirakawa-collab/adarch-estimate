"use client";
// 顔アイコン（選んだ顔 → Googleの写真 → 頭文字）。HTML用
export function Avatar({
  src,
  initials,
  size = 32,
  className = "",
  ring = false,
}: {
  src: string | null;
  initials: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.34)) };
  const ringCls = ring ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-transparent" : "";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={`rounded-full object-cover bg-[#f6f1e7] shrink-0 ${ringCls} ${className}`}
        style={style}
      />
    );
  }
  return (
    <span
      className={`rounded-full bg-zinc-800 text-white font-bold flex items-center justify-center shrink-0 ${ringCls} ${className}`}
      style={style}
    >
      {initials}
    </span>
  );
}
