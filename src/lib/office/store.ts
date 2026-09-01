"use client";
// グループオフィスの小さな共有状態（ヘッダーの在席バッジ ⇄ 常駐エージェント ⇄ /live）
// ライブラリを足さず useSyncExternalStore だけで持つ

import { useSyncExternalStore } from "react";

export interface Face {
  id: string;
  avatar: string | null;
  initials: string;
  name: string;
}
export interface OfficeState {
  ready: boolean; // 1回でも beat が返った
  meId: string | null;
  isHq: boolean;
  online: number;
  faces: Face[];
  latestChatAt: string | null;
  unreadChat: boolean;
}

const LS_KEY = "office:chatSeenAt";

let state: OfficeState = {
  ready: false,
  meId: null,
  isHq: false,
  online: 0,
  faces: [],
  latestChatAt: null,
  unreadChat: false,
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

/** チャットを見た時刻（この端末だけ）。未読の点の判定に使う */
export function chatSeenAt(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}
export function markChatSeen(iso: string) {
  try {
    localStorage.setItem(LS_KEY, iso);
  } catch {
    /* private mode 等 */
  }
  setOfficeState({ unreadChat: false });
}

/** 地図や通知から「この人とのひとことを開く」。prefill があれば入力欄に入れる */
export function openOfficeThread(userId: string, prefill?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("office:open", { detail: { userId, prefill } }));
}
