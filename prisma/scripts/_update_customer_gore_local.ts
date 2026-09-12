// ローカル検証専用: update_customer を代表の権限で1回実行（日本ゴア → Gore Japan合同会社）
import { loadViewer } from "../../src/lib/mcp/os-read-tools";
import { updateCustomer, WriteError } from "../../src/lib/mcp/os-write-tools";
async function main() {
  const v = (await loadViewer("hiroki.shirakawa@adarch.co.jp"))!;
  console.log("viewer:", v.name, v.role, v.branchId);
  // 1) 変更なしのときは止まること
  try { await updateCustomer(v, { id: "cmmx716jy0000rnbl439lrwl0", name: "日本ゴア合同会社" }); console.log("NG: 止まらなかった"); }
  catch (e) { console.log("no-change check:", e instanceof WriteError ? "OK ->" : "NG ->", (e as Error).message); }
  // 2) 本番の更新
  const r = await updateCustomer(v, { id: "cmmx716jy0000rnbl439lrwl0", name: "Gore Japan合同会社", nameKana: "ゴアジャパンゴウドウガイシャ", appendNote: "旧社名: 日本ゴア合同会社（部門経営統合により Gore Japan合同会社へ・契約巻き直し済み）" });
  console.log(JSON.stringify(r, null, 1));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
