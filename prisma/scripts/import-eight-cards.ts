/**
 * Eight エクスポート CSV → Ad-Arch OS BusinessCard モデル インポートスクリプト
 *
 * 使い方:
 *   cd my-first-project
 *   npx tsx prisma/scripts/import-eight-cards.ts <CSVパス>
 *
 * オプション:
 *   --skip-ai   AIエンリッチメントをスキップ（既にaiIndustryが設定済みの場合）
 */

import fs from "fs";
import csv from "csv-parse/sync";
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Anthropic from "@anthropic-ai/sdk";

// ── Prisma 接続 ──────────────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// ── 都道府県リスト（住所から抽出用）────────────────────────────
const PREFECTURES = [
  "北海道",
  "青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

function extractPrefecture(address: string): string | null {
  if (!address) return null;
  for (const pref of PREFECTURES) {
    if (address.startsWith(pref)) return pref;
  }
  return null;
}

// ── CSV boolean 変換 ─────────────────────────────────────────────
function csvBool(val: string | undefined): boolean {
  return val?.trim() === "1";
}

// ── 日付パース ──────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  if (!s?.trim()) return null;
  const normalized = s.trim().replace(/\//g, "-");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

// ── CSV カラム名 → 地域フラグ マッピング ─────────────────────────
const REGION_COL_MAP: Record<string, string[]> = {
  "北海道":                                         ["regionHokkaido"],
  "東北（青森、岩手、秋田、宮城、山形、福島）":     ["regionTohoku"],
  "北関東（茨城、栃木、群馬、山梨、長野）":         ["regionKitakanto"],
  "南関東（埼玉、千葉、東京、神奈川）":             ["regionSaitama", "regionChiba", "regionTokyo", "regionKanagawa"],
  "北陸（新潟、富山、石川、福井）":                 ["regionChubu"],
  "東海（静岡、岐阜、愛知、三重）":                 ["regionChubu"],
  "近畿（滋賀、京都、奈良、和歌山、大阪、兵庫）":   ["regionKansai"],
  "中国（鳥取、島根、岡山、広島、山口）":           ["regionChugoku"],
  "四国（徳島、香川、愛媛、高知）":                 ["regionShikoku"],
  "九州（福岡、佐賀、長崎、大分、熊本、宮崎、鹿児島）": ["regionKyushu"],
  "沖縄":                                           ["regionKyushu"],
};

// ── AI エンリッチメント ─────────────────────────────────────────
async function enrichCompaniesWithAI(
  companies: Array<{ companyName: string; department: string }>
): Promise<Map<string, { industry: string; summary: string; tags: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("  ⚠️ ANTHROPIC_API_KEY 未設定 → AI エンリッチメントをスキップ");
    return new Map();
  }

  const client = new Anthropic({ apiKey });
  const result = new Map<string, { industry: string; summary: string; tags: string }>();

  // バッチ化（20社ずつ）
  const BATCH_SIZE = 20;
  const batches: Array<Array<{ companyName: string; department: string }>> = [];
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    batches.push(companies.slice(i, i + BATCH_SIZE));
  }

  console.log(`\n  🤖 AI エンリッチメント: ${companies.length}社 → ${batches.length}バッチ`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const list = batch
      .map((c, idx) => `${idx + 1}. ${c.companyName}（${c.department || "部署不明"}）`)
      .join("\n");

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `以下の企業リストに対して、各企業の業界カテゴリ（IT/広告/製造/不動産/金融/メディア/教育/医療/飲食/小売/建設/自治体/その他）、事業概要（1行30文字以内）、関連タグ（カンマ区切り3つ以内）を判定してください。

企業リスト:
${list}

以下のJSON配列形式で回答してください（他の文字は不要）:
[{"company":"会社名","industry":"業界","summary":"事業概要","tags":"タグ1,タグ2"}]`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      // JSON 抽出（```json ... ``` でラップされている場合も対応）
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          company: string;
          industry: string;
          summary: string;
          tags: string;
        }>;
        for (const item of parsed) {
          result.set(item.company, {
            industry: item.industry,
            summary: item.summary,
            tags: item.tags,
          });
        }
      }

      if ((i + 1) % 10 === 0 || i === batches.length - 1) {
        console.log(`    進捗: ${i + 1}/${batches.length} バッチ完了 (${result.size}社)`);
      }

      // レート制限対策
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(
        `    ❌ バッチ${i + 1}エラー:`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  return result;
}

// ── メイン ───────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith("--"));
  const skipAI = args.includes("--skip-ai");

  if (!csvPath) {
    console.error("Usage: npx tsx prisma/scripts/import-eight-cards.ts <CSV_PATH> [--skip-ai]");
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  // BOM を除去
  const cleanRaw = raw.replace(/^\uFEFF/, "");
  const rows: Record<string, string>[] = csv.parse(cleanRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
  });

  console.log(`\n📂 CSV読み込み完了: ${rows.length} 件\n`);

  // ── DB からユーザーを取得 ──────────────────────────────────────
  const dbUsers = await db.user.findMany({
    select: { id: true, name: true, email: true },
  });
  const userByName = new Map(
    dbUsers.filter((u) => u.name).map((u) => [u.name!, u])
  );

  console.log(`  DBユーザー数: ${dbUsers.length}`);
  console.log(`  ユーザー名一覧: ${dbUsers.map((u) => u.name).join(", ")}\n`);

  // ── デフォルトユーザー（本部ADMIN）─────────────────────────────
  const adminUser = dbUsers.find((u) => u.email === "hiroki.shirakawa@adarch.co.jp") ?? dbUsers[0];
  if (!adminUser) throw new Error("ユーザーが DB に 1 件も存在しません");

  // ── フェーズ1: 分析レポート ─────────────────────────────────────
  console.log("═".repeat(60));
  console.log("【フェーズ1】分析レポート");
  console.log("═".repeat(60));

  const ownerNames = new Set<string>();
  const missingOwners = new Set<string>();
  const uniqueCompanies = new Map<string, string>(); // companyName → department

  for (const row of rows) {
    const ownerName = row["所有者"]?.trim() ?? "";
    ownerNames.add(ownerName);

    // (解除済) ユーザーまたは未登録ユーザーをチェック
    const cleanOwner = ownerName.replace(/^\(解除済\)/, "").trim();
    if (!userByName.has(cleanOwner) && !userByName.has(ownerName)) {
      missingOwners.add(ownerName);
    }

    const cn = row["会社名"]?.trim();
    const dep = row["部署名"]?.trim() ?? "";
    if (cn && !uniqueCompanies.has(cn)) {
      uniqueCompanies.set(cn, dep);
    }
  }

  console.log(`\n  所有者数: ${ownerNames.size}`);
  if (missingOwners.size > 0) {
    console.log(`  ⚠️ DB未登録の所有者 (${missingOwners.size} 件) → 本部ADMIN (${adminUser.name}) に割り当て`);
    for (const name of missingOwners) console.log(`     • ${name}`);
  }
  console.log(`  ユニーク企業数: ${uniqueCompanies.size}`);

  // ── フェーズ2: AI エンリッチメント ──────────────────────────────
  let aiData = new Map<string, { industry: string; summary: string; tags: string }>();

  if (!skipAI) {
    console.log("\n" + "═".repeat(60));
    console.log("【フェーズ2】AI エンリッチメント");
    console.log("═".repeat(60));

    const companyList = Array.from(uniqueCompanies.entries()).map(
      ([name, dept]) => ({ companyName: name, department: dept })
    );
    aiData = await enrichCompaniesWithAI(companyList);
    console.log(`  ✅ AI データ取得完了: ${aiData.size} 社`);
  } else {
    console.log("\n  ⏭  AI エンリッチメントをスキップ (--skip-ai)");
  }

  // ── フェーズ3: 名刺インポート ──────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("【フェーズ3】名刺をインポート");
  console.log("═".repeat(60));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const companyName = row["会社名"]?.trim() ?? "";
    const lastName = row["姓"]?.trim() ?? "";
    const firstName = row["名"]?.trim() ?? "";

    if (!companyName || !lastName) {
      console.log(`   ⏭  スキップ: 会社名/姓が空`);
      skipped++;
      continue;
    }

    // 所有者マッチ
    const ownerName = row["所有者"]?.trim() ?? "";
    const cleanOwner = ownerName.replace(/^\(解除済\)/, "").trim();
    const owner = userByName.get(cleanOwner) ?? userByName.get(ownerName) ?? adminUser;

    // 住所から都道府県を抽出
    const rawAddress = row["住所"]?.trim() ?? "";
    const prefecture = extractPrefecture(rawAddress);

    // 地域フラグ
    const regionFlags: Record<string, boolean> = {
      regionHokkaido: false,
      regionTohoku: false,
      regionKitakanto: false,
      regionSaitama: false,
      regionChiba: false,
      regionTokyo: false,
      regionKanagawa: false,
      regionChubu: false,
      regionKansai: false,
      regionChugoku: false,
      regionShikoku: false,
      regionKyushu: false,
    };

    for (const [csvCol, schemaFields] of Object.entries(REGION_COL_MAP)) {
      if (csvBool(row[csvCol])) {
        for (const field of schemaFields) {
          regionFlags[field] = true;
        }
      }
    }

    // タグの収集（マイタグ + イベントタグ）
    const tagParts: string[] = [];
    const myTags = row["マイタグ"]?.trim();
    if (myTags) tagParts.push(myTags);
    if (csvBool(row["クリエイター博覧会2025_06"])) tagParts.push("クリエイター博覧会2025");
    if (csvBool(row["さいたまスーパーアリーナ展示会2025・1月"])) tagParts.push("さいたまSA展示会2025/1");

    // AI データ
    const ai = aiData.get(companyName);

    const data = {
      companyName,
      department: row["部署名"]?.trim() || null,
      title: row["役職"]?.trim() || null,
      lastName,
      firstName: firstName || null,
      email: row["e-mail"]?.trim() || null,
      postalCode: row["郵便番号"]?.trim() || null,
      address: rawAddress || null,
      companyPhone: row["TEL会社"]?.trim() || null,
      directPhone: row["TEL直通"]?.trim() || null,
      fax: row["Fax"]?.trim() || null,
      mobilePhone: row["携帯電話"]?.trim() || null,
      url: row["URL"]?.trim() || null,
      exchangeDate: parseDate(row["名刺交換日"] ?? ""),
      tags: tagParts.length > 0 ? tagParts.join(",") : null,
      wantsCollab: csvBool(row["コラボ希望"]),
      isOrdered: csvBool(row["受注済"]),
      isCompetitor: csvBool(row["競合・取扱注意"]),
      isCreator: csvBool(row["制作スタッフ（クリエイター）"]),
      prefecture,
      ...regionFlags,
      aiIndustry: ai?.industry ?? null,
      aiSummary: ai?.summary ?? null,
      aiTags: ai?.tags ?? null,
      sharedMemoTitle: row["共有メモタイトル"]?.trim() || null,
      exchangePlace: row["名刺交換場所"]?.trim() || null,
      workHistory: row["仕事経過"]?.trim() || null,
      personality: row["人柄"]?.trim() || null,
      textMemo: row["テキストメモ"]?.trim() || null,
      ownerId: owner.id,
    };

    try {
      const result = await db.businessCard.upsert({
        where: {
          companyName_lastName_firstName: {
            companyName,
            lastName,
            firstName: firstName || "",
          },
        },
        create: data,
        update: data,
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }

      if ((created + updated) % 200 === 0) {
        console.log(
          `   進捗: ${created + updated}/${rows.length} (新規:${created} 更新:${updated})`
        );
      }
    } catch (e) {
      console.error(
        `   ❌ エラー: ${companyName} ${lastName} ${firstName}:`,
        e instanceof Error ? e.message : String(e)
      );
      skipped++;
    }
  }

  // ── 完了レポート ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("【完了】");
  console.log(`  新規登録: ${created} 件`);
  console.log(`  更新:     ${updated} 件`);
  console.log(`  スキップ: ${skipped} 件`);
  console.log(`  AI情報:   ${aiData.size} 社`);
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ エラー:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
