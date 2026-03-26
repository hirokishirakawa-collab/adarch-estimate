"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  path: string;
  label: string;
  icon?: string;
}

export function FavoriteButton({ path, label, icon }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data: { path: string }[]) => {
        if (Array.isArray(data)) {
          setIsFavorited(data.some((f) => f.path === path));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [path]);

  const toggle = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isFavorited) {
        await fetch(`/api/favorites?path=${encodeURIComponent(path)}`, {
          method: "DELETE",
        });
        setIsFavorited(false);
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, label, icon }),
        });
        if (res.ok) {
          setIsFavorited(true);
        } else {
          const data = await res.json();
          if (data.error) alert(data.error);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      title={isFavorited ? "ピン留め解除" : "ピン留め"}
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all",
        "hover:bg-zinc-100 disabled:opacity-50",
        isFavorited ? "text-amber-500" : "text-zinc-300 hover:text-zinc-400"
      )}
    >
      <Star
        className="w-4 h-4"
        fill={isFavorited ? "currentColor" : "none"}
      />
    </button>
  );
}
