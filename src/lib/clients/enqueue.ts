// ==============================================================
// 新しく登録された顧客を、レスポンスを返した後に取引先マップへ取り込む
//
// 登録の処理を待たせないよう after() で回す（Google Places・会社サイトの巡回で数秒かかる）。
// 失敗しても登録には影響させない。取りこぼしは毎朝の /api/cron/client-enrich が拾う。
// ==============================================================

import { after } from "next/server";
import { runClientEnrich } from "./enrich";

export function enrichCustomersAfterResponse(customerIds: string[]): void {
  const ids = customerIds.filter(Boolean);
  if (ids.length === 0) return;
  after(async () => {
    try {
      const stats = await runClientEnrich({ customerIds: ids, limit: ids.length, concurrency: 2 });
      console.log("[client-enrich:new-customer]", JSON.stringify({ ids: ids.length, ...stats }));
    } catch (e) {
      console.error("[client-enrich:new-customer] 失敗", e instanceof Error ? e.message : e);
    }
  });
}
