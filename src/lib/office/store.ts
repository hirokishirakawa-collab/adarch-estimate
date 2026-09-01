"use client";
// グループオフィスの小さな共有状態（ヘッダーの在席バッジ ⇄ 常駐エージェント）
// ライブラリを足さず useSyncExternalStore だけで持つ

import { useSyncExternalStore } from "react";

export interface OfficeState {
  ready: boolean; // 1回でも beat が返った
  meId: string | null;
  isHq: boolean;
  online: number;
  voice: boolean;
  callMinutes: number;
  bookingUrl: string;
}

let state: OfficeState = {
  ready: false,
  meId: null,
  isHq: false,
  online: 0,
  voice: false,
  callMinutes: 5,
  bookingUrl: "",
};
const listeners = new Set<() => void>();

export function setOfficeState(patch: Partial<OfficeState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useOfficeState(): OfficeState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** 地図や通知から「この人とのスレッドを開く」。prefill があれば入力欄に入れる */
export function openOfficeThread(userId: string, prefill?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("office:open", { detail: { userId, prefill } }));
}
