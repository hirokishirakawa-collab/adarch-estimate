import { config } from "dotenv";
config({ path: ".env.local" });
(async () => {
  const { db } = await import("../../src/lib/db");
  const { mfFetch, mfGetBilling } = await import("../../src/lib/mf-invoice");
  const targets: [string, string, string][] = [ // [id prefix, no, partner]
    ["K0mE03IP","1250","B-STYLE"],["GiQ6Ts0M","1248","木本"],["z4B8M6FO","1247","齋藤"],["c_O5Wxhl","1246","山口亜弓"],["g4LmOGZL","1245","HITO Film"],
    ["D8w_979g","1244","金山"],["axC4J2Gj","1243","ジツカ"],["fO0ruq0b","1242","ヨシハラ"],["x9-G_jXF","1241","U.create"],["T3-3qjjI","1239","片桐"],
    ["Lpew3UPP","1238","オーセントライク"],["O4jxPKuw","1237","QUEST"],["lTGsnXz6","1236","HALO"],["xN6b4H-t","1235","TooN"],
  ];
  const list = await mfFetch<any>(`/billings?range_key=billing_date&from=2026-08-31&to=2026-08-31&per_page=100`);
  const arr: any[] = Array.isArray(list) ? list : (list.data ?? list.billings ?? []);
  const deleted: string[] = [], failed: string[] = [];
  for (const [pre, no, name] of targets) {
    const b = arr.find((x) => x.id.startsWith(pre) && x.billing_number === no);
    if (!b) { failed.push(`${no} ${name}: 見つからず`); continue; }
    if (!/ロイヤリティ/.test(b.title ?? "") || b.email_status !== "未送信") { failed.push(`${no} ${name}: 条件不一致(${b.title}/${b.email_status})`); continue; }
    try {
      await mfFetch(`/billings/${encodeURIComponent(b.id)}`, { method: "DELETE" });
      deleted.push(`${no} ${name} ¥${Number(b.total_price)}`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) { failed.push(`${no} ${name}: ${(e as Error).message.slice(0, 120)}`); }
  }
  console.log("deleted:", deleted.length, deleted);
  console.log("failed:", failed);
  await db.auditLog.create({ data: { action: "mf_billing_deleted_duplicates", email: "hiroki.shirakawa@adarch.co.jp", name: "白川 裕喜（本部）", entity: "mf_billing", entityId: "2026-08-31", detail: `8月分ロイヤリティの手作業請求書（OS作成分と重複・未送信）を削除: ${deleted.join(" / ")}${failed.length ? ` ／失敗: ${failed.join(" / ")}` : ""}（代表承認 2026-09-01）` } });
  // 削除確認
  let gone = 0; for (const [pre] of targets) { const b = arr.find((x) => x.id.startsWith(pre)); if (!b) continue; try { await mfGetBilling(b.id); } catch { gone++; } }
  console.log("confirmed gone:", gone, "/", targets.length);
  await db.$disconnect();
})().catch((e) => { console.log("ERROR:", e.message); process.exit(1); });
