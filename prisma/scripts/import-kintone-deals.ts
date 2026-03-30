/**
 * kintone 商談管理 CSV → Ad-Arch OS Deal モデル インポートスクリプト
 *
 * 使い方:
 *   cd ad-arch-os
 *   npx tsx prisma/scripts/import-kintone-deals.ts <CSVパス>
 *
 * ステータスマッピング:
 *   継続検討 → QUALIFYING
 *   情報共有 → PROSPECTING
 *   プロジェクト化 → CLOSED_WON
 *   クローズ → CLOSED_LOST
 */

import fs from "fs";
import csv from "csv-parse/sync";
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ── Prisma 接続 ──────────────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ── メール → 拠点ID マッピング (customers.ts と同期) ────────────
const EMAIL_TO_BRANCH: Record<string, string> = {
  "hiroki.shirakawa@adarch.co.jp": "branch_hq",
  "ishikawa@adarch.co.jp":        "branch_isk",
  "kagawa_okayama@adarch.co.jp":  "branch_kgo",
  "mtakahashi@adarch.co.jp":      "branch_kyt",
  "katagiri@adarch.co.jp":        "branch_tky",
  "shoma.utamaru@adarch.co.jp":   "branch_ymc",
  "s.keita@adarch.co.jp":         "branch_hkd",
  "toru.shiraishi@adarch.co.jp":  "branch_tk2",
  "takashi.miyamoto@adarch.co.jp":"branch_kns",
  "okinawa@adarch.co.jp":         "branch_okn",
  "tokushima@adarch.co.jp":       "branch_tks",
  "ibaraki@adarch.co.jp":         "branch_ibk",
  "hamaguchi@adarch.co.jp":       "branch_fku",
  "fujiwara@adarch.co.jp":        "branch_knw",
};

// ── kintone ステータス → DealStatus ────────────────────────────
function mapStatus(kintoneStatus: string): string {
  switch (kintoneStatus.trim()) {
    case "継続検討":   return "QUALIFYING";
    case "情報共有":   return "PROSPECTING";
    case "プロジェクト化": return "CLOSED_WON";
    case "クローズ":   return "CLOSED_LOST";
    default:           return "PROSPECTING";
  }
}

// ── 日付パース (YYYY/MM/DD HH:mm or YYYY/MM/DD) ─────────────────
function parseDate(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const normalized = s.trim().replace(/\//g, "-");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

// ── notes 組み立て ───────────────────────────────────────────────
function buildNotes(row: Record<string, string>): string {
  const parts: string[] = [];
  if (row["商談種別"])            parts.push(`【商談種別】${row["商談種別"]}`);
  if (row["業界"])                parts.push(`【業界】${row["業界"]}`);
  if (row["商談部署"])            parts.push(`【商談部署】${row["商談部署"]}`);
  if (row["商談方法"])            parts.push(`【商談方法】${row["商談方法"]}`);
  if (row["商談相手（氏名・役職）"]) parts.push(`【商談相手】${row["商談相手（氏名・役職）"]}`);
  if (row["相手の関心事項"])      parts.push(`\n【関心事項】\n${row["相手の関心事項"]}`);
  if (row["次アクション"])        parts.push(`\n【次アクション】\n${row["次アクション"]}`);
  if (row["レコード番号"])        parts.push(`\n（kintone #${row["レコード番号"]}）`);
  return parts.join("　").trim();
}

// ── メイン ───────────────────────────────────────────────────────
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx prisma/scripts/import-kintone-deals.ts <CSV_PATH>");
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows: Record<string, string>[] = csv.parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
  });

  console.log(`\n📂 CSV読み込み完了: ${rows.length} 件\n`);

  // ── DB から既存データを取得 ──────────────────────────────────────
  const [dbBranches, dbUsers, dbCustomers] = await Promise.all([
    db.branch.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, email: true, name: true, branchId: true } }),
    db.customer.findMany({ select: { id: true, name: true, branchId: true, prefecture: true } }),
  ]);

  const branchByCode = new Map(dbBranches.map((b) => [b.id, b]));
  const userByEmail = new Map(dbUsers.map((u) => [u.email?.toLowerCase(), u]));
  const customerByName = new Map(dbCustomers.map((c) => [c.name.trim(), c]));

  console.log(`  DB拠点数: ${dbBranches.length}  DBユーザー数: ${dbUsers.length}  DB顧客数: ${dbCustomers.length}`);
  console.log(`  拠点一覧: ${dbBranches.map((b) => `${b.id}(${b.name})`).join(", ")}\n`);

  // ── デフォルト拠点 (本部 branch_hq) ────────────────────────────
  const defaultBranch = branchByCode.get("branch_hq") ?? dbBranches[0];
  if (!defaultBranch) throw new Error("拠点が DB に 1 件も存在しません");

  // ── フェーズ1: 分析レポート ─────────────────────────────────────
  console.log("═".repeat(60));
  console.log("【フェーズ1】分析レポート");
  console.log("═".repeat(60));

  const missingCustomers = new Set<string>();
  const missingUsers = new Set<string>();

  for (const row of rows) {
    const companyName = row["会社名"]?.trim();
    if (companyName && !customerByName.has(companyName)) {
      missingCustomers.add(companyName);
    }
    const email = row["担当者"]?.trim().toLowerCase();
    if (email && !userByEmail.has(email)) {
      missingUsers.add(email);
    }
  }

  if (missingCustomers.size > 0) {
    console.log(`\n⚠️  DB未登録の顧客 (${missingCustomers.size} 件) → 新規作成します`);
    for (const name of missingCustomers) {
      const pref = rows.find((r) => r["会社名"]?.trim() === name)?.["都道府県"]?.trim() ?? null;
      console.log(`   • ${name}${pref ? `（${pref}）` : ""}`);
    }
  } else {
    console.log("\n✅ 全顧客が DB に存在します");
  }

  if (missingUsers.size > 0) {
    console.log(`\n⚠️  DB未登録の担当者 (${missingUsers.size} 件) → 担当者なし(null)でインポート`);
    for (const email of missingUsers) console.log(`   • ${email}`);
  }

  // ステータス集計
  const statusCount: Record<string, number> = {};
  for (const row of rows) {
    const s = row["商談ステータス"]?.trim() ?? "不明";
    statusCount[s] = (statusCount[s] ?? 0) + 1;
  }
  console.log("\n📊 ステータス内訳:");
  for (const [k, v] of Object.entries(statusCount)) {
    console.log(`   ${k} (${v}件) → ${mapStatus(k)}`);
  }

  // ── フェーズ2: 顧客の新規作成 ──────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("【フェーズ2】未登録顧客を新規作成");
  console.log("═".repeat(60));

  for (const name of missingCustomers) {
    const srcRow = rows.find((r) => r["会社名"]?.trim() === name)!;
    const pref = srcRow["都道府県"]?.trim() || null;

    // 担当者メールから拠点を特定
    const assigneeEmail = srcRow["担当者"]?.trim().toLowerCase() ?? "";
    const branchId = EMAIL_TO_BRANCH[assigneeEmail] ?? defaultBranch.id;
    const targetBranch = branchByCode.get(branchId) ?? defaultBranch;

    const newCustomer = await db.customer.create({
      data: {
        name,
        prefecture: pref,
        branchId: targetBranch.id,
        status: "ACTIVE",
      },
    });
    customerByName.set(name, { id: newCustomer.id, name, branchId: targetBranch.id, prefecture: pref });
    console.log(`   ✅ 新規顧客作成: ${name} [${targetBranch.name}]`);
  }

  // ── フェーズ3: 商談インポート ────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("【フェーズ3】商談をインポート");
  console.log("═".repeat(60));

  let created = 0;
  let skipped = 0;
  const needsUpdatedAt: Array<{ id: string; date: Date }> = [];

  for (const row of rows) {
    const companyName = row["会社名"]?.trim() ?? "";
    const customer = customerByName.get(companyName);
    if (!customer) {
      console.log(`   ⏭  スキップ: 顧客「${companyName}」が見つかりません`);
      skipped++;
      continue;
    }

    const assigneeEmail = row["担当者"]?.trim().toLowerCase() ?? "";
    const assignedUser = userByEmail.get(assigneeEmail) ?? null;

    // 拠点: 担当者のブランチ > メールのBRANCH_MAP > 顧客のブランチ > デフォルト
    const branchId =
      assignedUser?.branchId ??
      EMAIL_TO_BRANCH[assigneeEmail] ??
      customer.branchId ??
      defaultBranch.id;

    const status = mapStatus(row["商談ステータス"] ?? "");
    const title  = (row["商談概要"]?.trim() || companyName + " 商談").slice(0, 200);
    const notes  = buildNotes(row);

    const expectedCloseDate = parseDate(row["次回予定日"] ?? "");
    const kintoneUpdatedAt  = parseDate(row["更新日時"] ?? "");
    const kintoneCreatedAt  = parseDate(row["作成日時"] ?? "");

    // CLOSED 系は商談日を closedAt に
    const closedAt =
      status === "CLOSED_WON" || status === "CLOSED_LOST"
        ? kintoneUpdatedAt ?? kintoneCreatedAt
        : null;

    const deal = await db.deal.create({
      data: {
        title,
        status: status as Parameters<typeof db.deal.create>[0]["data"]["status"],
        notes: notes || null,
        expectedCloseDate,
        closedAt,
        customerId: customer.id,
        branchId,
        assignedToId: assignedUser?.id ?? null,
      },
    });

    // CLOSED_WON/CLOSED_LOST かつ kintone の更新日が 7 日以上前 → updatedAt を後で修正
    if (kintoneUpdatedAt && (status === "CLOSED_WON" || status === "CLOSED_LOST")) {
      needsUpdatedAt.push({ id: deal.id, date: kintoneUpdatedAt });
    }

    const archived = closedAt && kintoneUpdatedAt && kintoneUpdatedAt < new Date(Date.now() - 7 * 86400000);
    console.log(
      `   ✅ ${companyName.padEnd(30)} [${status}]${archived ? " 📦アーカイブ予定" : ""}`
    );
    created++;
  }

  // ── フェーズ4: updatedAt を kintone の更新日時に書き戻す ────────
  if (needsUpdatedAt.length > 0) {
    console.log(`\n  🕐 updatedAt を kintone 日時に修正 (${needsUpdatedAt.length} 件)`);
    for (const { id, date } of needsUpdatedAt) {
      await db.$executeRaw`UPDATE deals SET "updatedAt" = ${date} WHERE id = ${id}`;
    }
    console.log("  ✅ updatedAt 修正完了");
  }

  // ── 完了レポート ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("【完了】");
  console.log(`  インポート成功: ${created} 件`);
  console.log(`  スキップ:       ${skipped} 件`);
  const archivedCount = needsUpdatedAt.filter(
    ({ date }) => date < new Date(Date.now() - 7 * 86400000)
  ).length;
  console.log(`  アーカイブ対象: ${archivedCount} 件 (CLOSED 系 + 7日以上前)`);
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ エラー:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
