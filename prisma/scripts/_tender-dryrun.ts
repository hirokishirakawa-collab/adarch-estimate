// DBには一切書かない。取得と判定だけを実データで確認する。
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { fetchRecentTenders } from "@/lib/tender/kkj";
import { classifyTenders } from "@/lib/tender/classify";
import { resolveOrdererType } from "@/lib/tender/sync";

async function main() {
  const t0 = Date.now();
  const { items, hits, splitByPrefecture } = await fetchRecentTenders(10);
  console.log(`取得: ${items.length}件 / SearchHits=${hits} / 分割=${splitByPrefecture} / ${Date.now() - t0}ms`);

  // 発注者区分の判定を目視で確認する
  const LABEL = { MUNICIPAL: "市区町村", PREFECTURAL: "都道府県", OTHER: "国・その他" };
  const fetchOnly = process.argv.includes("--fetch-only");
  const counts = items.reduce<Record<string, number>>((acc, i) => {
    const k = resolveOrdererType(i);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\n── 発注者区分の内訳 ──", counts);
  console.log("── 判定の抜き取り ──");
  for (const i of items.slice(0, fetchOnly ? items.length : 20)) {
    console.log(`  ${LABEL[resolveOrdererType(i)].padEnd(6)} | 機関=${i.organizationName ?? "-"} / 所在地=${i.cityName ?? "-"}`);
  }
  console.log("");

  if (fetchOnly) return;

  const sample = items.slice(0, 24);
  const { results, failedBatches } = await classifyTenders(
    sample.map((i) => ({
      kkjKey: i.key,
      projectName: i.projectName,
      organizationName: i.organizationName,
      category: i.category,
      procedureType: i.procedureType,
      description: i.description,
    })),
  );
  console.log(`判定: ${results.length}/${sample.length}件 失敗バッチ=${failedBatches}\n`);

  const byKey = new Map(sample.map((s) => [s.key, s]));
  const order = { MATCH: 0, MAYBE: 1, MISMATCH: 2 } as const;
  for (const r of [...results].sort((a, b) => order[a.fit] - order[b.fit])) {
    const s = byKey.get(r.kkjKey)!;
    const mark = { MATCH: "○", MAYBE: "△", MISMATCH: "×" }[r.fit];
    console.log(`${mark} [${r.workType}] ${s.cityName ?? s.organizationName ?? "-"} / ${s.projectName.slice(0, 40)}`);
    console.log(`   ${r.reason}`);
    console.log(`   根拠: ${r.evidence}${r.needsQualification ? " ／ 入札参加資格あり" : ""}`);
  }
  const n = (f: string) => results.filter((r) => r.fit === f).length;
  console.log(`\n○${n("MATCH")}件 / △${n("MAYBE")}件 / ×${n("MISMATCH")}件`);
}
main();
