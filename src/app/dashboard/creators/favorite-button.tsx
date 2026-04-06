"use client";

import { Star } from "lucide-react";
import { toggleCreatorFavorite } from "./actions";
import { useTransition } from "react";

interface Props {
  creatorId: string;
  isFavorite: boolean;
}

export function FavoriteButton({ creatorId, isFavorite }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => {
      toggleCreatorFavorite(creatorId);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`p-1 rounded-md transition-all ${
        isPending ? "opacity-50" : "hover:bg-amber-50"
      }`}
      title={isFavorite ? "お気に入り解除" : "お気に入り登録"}
    >
      <Star
        style={{ width: "1rem", height: "1rem" }}
        className={
          isFavorite
            ? "text-amber-400 fill-amber-400"
            : "text-zinc-300 hover:text-amber-300"
        }
      />
    </button>
  );
}
