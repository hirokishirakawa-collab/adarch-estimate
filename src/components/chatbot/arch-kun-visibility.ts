"use client";

import { useEffect, useState } from "react";

// アーチくん（チャットボット）の表示/非表示
// 「いらない時に消せるように」(2026-08-26 代表指示)
// - localStorage に保持＝再表示するまで出ない（旧「24時間」タイマーは廃止）
// - ヘッダーのボタン／吹き出しの×／チャット画面の「非表示」のどこからでも切り替え可
const KEY = "arch-kun-hidden";
const EVENT = "arch-kun:visibility";

export function isArchKunHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setArchKunHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useArchKunHidden(): [boolean, (hidden: boolean) => void] {
  // SSR時は false で描画し、マウント後に実値を読む
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const sync = () => setHidden(isArchKunHidden());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [hidden, setArchKunHidden];
}
