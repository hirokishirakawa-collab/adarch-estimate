"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { setLineFriendRating } from "@/lib/actions/line";

/** ★5段階（クリックで設定・同じ星をもう一度で0に戻す） */
export function StarRating({ accountId, friendId, value, size = 14 }: { accountId: string; friendId: string; value: number; size?: number }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [hover, setHover] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const shown = hover ?? v;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      onClick={(e) => e.preventDefault()}
      onMouseLeave={() => setHover(null)}
      title={`評価 ${v}/5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={isPending}
          onMouseEnter={() => setHover(n)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const next = v === n ? 0 : n;
            setV(next);
            startTransition(async () => {
              await setLineFriendRating(accountId, friendId, next);
              router.refresh();
            });
          }}
          className="p-0 leading-none"
          aria-label={`${n}つ星`}
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= shown ? "text-amber-400 fill-amber-400" : "text-zinc-300"}
          />
        </button>
      ))}
    </span>
  );
}
