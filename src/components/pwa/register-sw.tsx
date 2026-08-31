"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    // サイネージ端末のプレイヤー（ログイン不要ページ）ではSWを登録しない。
    // OSのSWは activate 時に自分以外のキャッシュを全削除するため、素材キャッシュと干渉する。
    if (location.pathname.startsWith("/signage/player")) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  return null;
}
