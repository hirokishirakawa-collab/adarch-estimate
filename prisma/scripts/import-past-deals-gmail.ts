/**
 * 過去取引リスト（Gmail 2016〜2026・代表目視済み 2026-09-11）→ 本部の顧客＋過去の商談
 *
 * 使い方（既定は「確認だけ」＝書き込みなし）:
 *   DATABASE_URL=… npx tsx prisma/scripts/import-past-deals-gmail.ts <rows.json>            … 確認だけ
 *   DATABASE_URL=… npx tsx prisma/scripts/import-past-deals-gmail.ts <rows.json> --apply    … 書き込み
 *   DATABASE_URL=… npx tsx prisma/scripts/import-past-deals-gmail.ts --rollback <backup.json> … 元に戻す
 *
 * 代表決定（2026-09-11）:
 *   - 入れるのは 受注・失注・辞退・発注後に中止 だけ（見積のみ・不明は入れない）
 *   - 金額は一切入れない
 *   - 実績アーカイブ(branch_archive)にある同じ会社は本部(branch_hq)へ移して商談を付ける
 *   - 先方の担当者名は出さない（「○○様」は伏せる）
 *
 * 通知を出さないための入れ方（コードで確認済み）:
 *   受注のお祝い=closedAt が直近3日（api/deals/recent-wins）／グループライブ=deals.updatedAt が直近90日（api/live/feed）／
 *   朝のChatまとめ=前日の deals.updatedAt（cron/live-digest）／週次集計=createdAt（lib/digest）。
 *   → createdAt・updatedAt・closedAt を実際の年月にして、1社ごとに同じトランザクション内で書く。操作ログ・DealLog は作らない。
 */
import fs from "fs";
import path from "path";
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const MARK = "【過去取引リスト取込 2026-09-11】";
const HQ = "branch_hq";
const ARCHIVE = "branch_archive";
const OWNER_EMAIL = "hiroki.shirakawa@adarch.co.jp";
const ACTIVE_SINCE = new Date(Date.UTC(2024, 8, 1)); // 最後の受注がこれ以降なら「取引中」、それより前は「休眠」

type Row = {
  year_month: string; client: string; industry: string; prefecture: string; work: string; work_category: string;
  route: string; route_detail: string; status: string; reason: string; end_client: string; other_source: boolean;
};

const STATUS_MAP: Record<string, "CLOSED_WON" | "CLOSED_LOST"> = {
  "受注": "CLOSED_WON", "失注": "CLOSED_LOST", "辞退": "CLOSED_LOST", "発注後に中止": "CLOSED_LOST",
};

// 名前の一部しか一致しない既存顧客に結び付けるもの（代表確認 2026-09-11）。値は OS 上の顧客名
const LINK: Record<string, string> = {
  "FIBA Media(fibamedia.com)": "FIBA",
  "WHO神戸センター(WHO Centre for Health Development)": "WHO",
  "エバラ食品工業株式会社": "エバラ食品",
  "キリン": "キリンホールディングス",
  "公益財団法人新国立劇場運営財団": "新国立劇場",
  "外務省 領事局": "外務省",
  "日之出紙器工業株式会社": "日之出紙器",
  "朝日放送株式会社": "ABC朝日放送",
  "東京ミッドタウンマネジメント株式会社": "東京ミッドタウン",
  "株式会社長門屋本店": "長門屋",
  "独立行政法人日本芸術文化振興会 国立文楽劇場": "国立文楽劇場",
  "神戸市 健康局保健所保健課": "神戸市健康局",
};

const ORG = /株式会社|有限会社|合同会社|一般社団法人|一般財団法人|公益財団法人|公益社団法人|独立行政法人|国立研究開発法人|特定非営利活動法人|学校法人|医療法人|社会福祉法人/g;
const ckey = (name: string) =>
  name.normalize("NFKC").toLowerCase().replace(/\(.*?\)|（.*?）/g, "").replace(ORG, "").replace(/[\s・,.　]/g, "");

// 年月 → その月の1日 12:00 JST（日付がずれて見えないように）
const ymDate = (ym: string) => {
  const m = /^(\d{4})-(\d{1,2})/.exec(ym);
  if (!m) throw new Error(`年月が読めません: ${ym}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 3));
};
const monthIndex = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();

// 先方の担当者名は出さない（代表決定）: 「○○様」「○○ ○○様」を伏せる
//   ①メールから拾った先方担当者の名前（mask_names.json）: フルネームは見つけたら伏せる／名字だけは「様・さん・氏」付きのときだけ
//   ②それ以外の「○○様」: 直前の漢字2〜4文字だけ伏せる（「仕様」「同様」「お客様」は1文字なので対象外）
let NAME_LIST: string[] = [];
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function maskNames(s: string) {
  let t = s;
  for (const n of NAME_LIST) {
    if (n.includes(" ")) t = t.split(n).join("先方ご担当者");
    else t = t.replace(new RegExp(esc(n) + "\\s?(?=様|さま|さん|氏)", "g"), "先方ご担当者");
  }
  t = t.replace(/(先方ご担当者)\s?(様|さま|さん|氏)/g, "$1");
  t = t.replace(/(^|[^一-龥々])([一-龥々]{2,4})\s?(様|さま)/g, (_m, pre: string, name: string) => `${pre}${name === "先方ご担当" ? name : "先方ご担当者"}`);
  return t;
}

const PREFS = new Set(["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]);

// 受注額・見積額は OS に出さない（代表決定 2026-09-11）: 文章中の金額表記も消す
const AMOUNT = /(?:税込|税抜|税別)?\s*(?:[¥￥$]\s?[\d,，.]+(?:\s?[万千億])?円?|[\d,，.]+\s?(?:億|万|千)?\s?円|[\d,，.]+\s?(?:億|万)(?![人回件本部枚個社名台ヶか年時分秒]))(?:\s*[（(]?(?:税込|税抜|税別)[)）]?)?/g;
const maskAmounts = (s: string) => s.replace(AMOUNT, "（金額非表示）").replace(/(（金額非表示）)(?:[・、/／+＋〜~\s]*（金額非表示）)+/g, "$1");

function dealNotes(r: Row) {
  const lines = [MARK, `区分: ${r.status}`, `ジャンル: ${r.work_category}`, `依頼ルート: ${r.route}`];
  if (r.route_detail) lines.push(`経緯: ${maskAmounts(maskNames(r.route_detail))}`);
  if (r.end_client) lines.push(`エンドクライアント: ${r.end_client}`);
  if (STATUS_MAP[r.status] === "CLOSED_LOST" && r.reason) lines.push(`理由: ${maskAmounts(maskNames(r.reason))}`);
  return lines.join("\n");
}
function closingFactor(r: Row) {
  if (STATUS_MAP[r.status] !== "CLOSED_WON") return null;
  return r.route_detail ? `依頼ルート: ${r.route} ／ ${maskAmounts(maskNames(r.route_detail))}` : `依頼ルート: ${r.route}`;
}

async function rollback(backupPath: string) {
  const b = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  console.log(`元に戻します: 商談 ${b.createdDealIds.length} 件削除 / 新規顧客 ${b.createdCustomerIds.length} 社削除 / 既存顧客 ${b.updatedCustomers.length} 社を元の値に`);
  await db.$transaction(async (tx) => {
    await tx.deal.deleteMany({ where: { id: { in: b.createdDealIds }, notes: { startsWith: MARK } } });
    for (const c of b.updatedCustomers) {
      await tx.customer.update({ where: { id: c.id }, data: { branchId: c.branchId, industry: c.industry, prefecture: c.prefecture, status: c.status, notes: c.notes } });
      await tx.$executeRaw`UPDATE customers SET "updatedAt" = ${new Date(c.updatedAt)} WHERE id = ${c.id}`;
    }
    const left = await tx.deal.groupBy({ by: ["customerId"], where: { customerId: { in: b.createdCustomerIds } }, _count: true });
    const keep = new Set(left.map((x) => x.customerId));
    await tx.customer.deleteMany({ where: { id: { in: b.createdCustomerIds.filter((id: string) => !keep.has(id)) }, source: "GMAIL_ARCHIVE" } });
    if (keep.size) console.log(`  ⚠️ 取込後に別の商談が付いた顧客 ${keep.size} 社は消さずに残しました`);
  }, { timeout: 120_000 });
  console.log("完了");
}

// 取込済みの商談の件名・決め手・メモから金額表記を消す。raw SQL なので updatedAt は変わらない（通知が出ない）
async function fixAmounts(apply: boolean) {
  const ds = await db.deal.findMany({ where: { notes: { startsWith: MARK } }, select: { id: true, title: true, notes: true, closingFactor: true } });
  let n = 0;
  for (const d of ds) {
    const title = maskAmounts(d.title), notes = d.notes ? maskAmounts(d.notes) : d.notes, cf = d.closingFactor ? maskAmounts(d.closingFactor) : d.closingFactor;
    if (title === d.title && notes === d.notes && cf === d.closingFactor) continue;
    n++;
    if (n <= 8) console.log(`- ${d.title.slice(0, 40)}\n  → ${title.slice(0, 40)}\n  決め手: ${(cf ?? "").slice(0, 80)}`);
    if (apply) await db.$executeRaw`UPDATE deals SET title = ${title}, notes = ${notes}, "closingFactor" = ${cf} WHERE id = ${d.id}`;
  }
  console.log(`${apply ? "書き換えた" : "書き換える予定"}: ${n} / ${ds.length} 件`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--rollback") return rollback(args[1]);
  if (args[0] === "--fix-amounts") return fixAmounts(args[1] === "--apply");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("rows.json のパスを指定してください");
  const apply = args.includes("--apply");

  const all: Row[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  const namesPath = path.join(path.dirname(path.resolve(file)), "mask_names.json");
  NAME_LIST = fs.existsSync(namesPath) ? JSON.parse(fs.readFileSync(namesPath, "utf-8")) : [];
  if (!NAME_LIST.length) throw new Error(`先方担当者名の一覧がありません: ${namesPath}`);
  const rows = all.filter((r) => STATUS_MAP[r.status]);
  const byClient = new Map<string, Row[]>();
  for (const r of rows) byClient.set(r.client, [...(byClient.get(r.client) ?? []), r]);

  const owner = await db.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (!owner) throw new Error(`${OWNER_EMAIL} のユーザーが見つかりません`);

  const existing = await db.customer.findMany({
    where: { branchId: { in: [HQ, ARCHIVE] } },
    select: { id: true, name: true, branchId: true, status: true, industry: true, prefecture: true, notes: true, updatedAt: true },
  });
  const byKey = new Map<string, typeof existing>();
  for (const c of existing) byKey.set(ckey(c.name), [...(byKey.get(ckey(c.name)) ?? []), c]);
  const byName = new Map(existing.map((c) => [c.name, c]));

  // 他拠点に同名の顧客がいるか（報告だけ）
  const others = await db.customer.findMany({ where: { branchId: { notIn: [HQ, ARCHIVE] } }, select: { name: true, branch: { select: { name: true } } } });
  const otherByKey = new Map(others.map((c) => [ckey(c.name), `${c.name}（${c.branch.name}）`]));

  type Plan = { client: string; rows: Row[]; target: (typeof existing)[number] | null; how: string };
  const plans: Plan[] = [];
  const ambiguous: string[] = [];
  for (const [client, rs] of byClient) {
    let target: Plan["target"] = null;
    let how = "新規作成";
    if (LINK[client]) {
      target = byName.get(LINK[client]) ?? null;
      how = target ? `既存に結び付け（名前の一部一致・代表確認済み: ${LINK[client]}）` : `⚠️結び付け先「${LINK[client]}」が見つからない→新規作成`;
    } else {
      const hit = byKey.get(ckey(client)) ?? [];
      if (hit.length > 1) { ambiguous.push(`${client} → ${hit.map((h) => h.name).join(" / ")}`); target = hit.find((h) => h.branchId === HQ) ?? hit[0]; }
      else if (hit.length === 1) target = hit[0];
      if (target) how = target.branchId === ARCHIVE ? "実績アーカイブ→本部へ移して結び付け" : "本部の既存顧客に結び付け";
    }
    plans.push({ client, rows: rs, target, how });
  }

  // 既存の商談と重なるもの（同じ顧客・前後1か月以内・同じ受注/失注）は作らない。再実行時は目印つきの同じ商談を作らない
  const targetIds = plans.map((p) => p.target?.id).filter((x): x is string => !!x);
  const oldDeals = await db.deal.findMany({
    where: { customerId: { in: targetIds } },
    select: { id: true, customerId: true, title: true, status: true, closedAt: true, createdAt: true, notes: true },
  });
  const dealsByCustomer = new Map<string, typeof oldDeals>();
  for (const d of oldDeals) dealsByCustomer.set(d.customerId, [...(dealsByCustomer.get(d.customerId) ?? []), d]);

  const skipped: string[] = [];
  const report = { newCustomers: 0, linkedHq: 0, movedFromArchive: 0, linkedPartial: 0, deals: 0, won: 0, lost: 0, skippedDeals: 0 };
  const work: { plan: Plan; deals: Row[] }[] = [];
  // 文字の2文字組の重なり（0〜1）。既存の商談1件に対応させるのは、時期が近く内容が最も似た取込行1件だけ
  const bigrams = (s: string) => { const t = s.normalize("NFKC").replace(/\s/g, ""); return new Set(Array.from({ length: Math.max(t.length - 1, 0) }, (_, i) => t.slice(i, i + 2))); };
  const sim = (a: string, b: string) => { const A = bigrams(a), B = bigrams(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); return n / Math.min(A.size, B.size); };
  // 同じ既存顧客に向かう取込行が複数の社名に分かれていても、既存の商談は1回しか使わない。名前が完全に一致する方を先に照合する
  const usedOld = new Set<string>();
  plans.sort((a, b) => Number(!!LINK[a.client]) - Number(!!LINK[b.client]));
  for (const p of plans) {
    const olds = (p.target ? dealsByCustomer.get(p.target.id) ?? [] : []).filter((o) => !usedOld.has(o.id));
    const dropped = new Set<Row>();
    // 再実行: 目印つきで同じ件名の商談があれば作らない
    for (const r of p.rows) if (olds.some((o) => o.notes?.startsWith(MARK) && o.title === r.work.slice(0, 200))) dropped.add(r);
    for (const o of olds.filter((o) => !o.notes?.startsWith(MARK))) {
      const od = o.closedAt ?? o.createdAt;
      const cands = p.rows
        .filter((r) => !dropped.has(r) && STATUS_MAP[r.status] === o.status && Math.abs(monthIndex(ymDate(r.year_month)) - monthIndex(od)) <= 1)
        .map((r) => ({ r, gap: Math.abs(monthIndex(ymDate(r.year_month)) - monthIndex(od)), s: sim(r.work, o.title) }))
        .sort((a, b) => a.gap - b.gap || b.s - a.s);
      if (cands[0]) {
        usedOld.add(o.id);
        dropped.add(cands[0].r);
        skipped.push(`${p.client} ${cands[0].r.year_month}「${cands[0].r.work.slice(0, 30)}」≒ 既存「${o.title.slice(0, 30)}」`);
      }
    }
    const keepRows = p.rows.filter((r) => !dropped.has(r));
    report.skippedDeals += p.rows.length - keepRows.length;
    if (!p.target) report.newCustomers++;
    else if (p.how.startsWith("既存に結び付け")) report.linkedPartial++;
    else if (p.target.branchId === ARCHIVE) report.movedFromArchive++;
    else report.linkedHq++;
    report.deals += keepRows.length;
    report.won += keepRows.filter((r) => STATUS_MAP[r.status] === "CLOSED_WON").length;
    report.lost += keepRows.filter((r) => STATUS_MAP[r.status] === "CLOSED_LOST").length;
    work.push({ plan: p, deals: keepRows });
  }

  const outDir = path.dirname(path.resolve(file));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const plansOut = work.map(({ plan, deals }) => ({
    client: plan.client, how: plan.how, target: plan.target ? `${plan.target.name}（${plan.target.branchId}）` : null,
    otherBranchSameName: otherByKey.get(ckey(plan.client)) ?? null,
    deals: deals.map((r) => `${r.year_month} ${r.status} ${r.work.slice(0, 40)}`),
  }));
  fs.writeFileSync(path.join(outDir, `import_plan_${stamp}.json`), JSON.stringify({ report, ambiguous, skipped, plans: plansOut }, null, 1));
  console.log(JSON.stringify(report));
  console.log(`同名が複数ある顧客: ${ambiguous.length}`); ambiguous.forEach((a) => console.log("  " + a));
  console.log(`既存と重なるため作らない商談: ${skipped.length}`); skipped.forEach((s) => console.log("  " + s));
  const otherHits = plansOut.filter((p) => p.otherBranchSameName);
  console.log(`他拠点に同名の顧客がいる: ${otherHits.length}`); otherHits.forEach((p) => console.log(`  ${p.client} ↔ ${p.otherBranchSameName}`));
  console.log(`計画ファイル: ${path.join(outDir, `import_plan_${stamp}.json`)}`);

  if (!apply) { console.log("\n確認だけ（書き込みなし）。書き込むには --apply を付けて再実行"); return; }

  const backup = { createdDealIds: [] as string[], createdCustomerIds: [] as string[], updatedCustomers: [] as unknown[] };
  const backupPath = path.join(outDir, `import_backup_${stamp}.json`);
  const save = () => fs.writeFileSync(backupPath, JSON.stringify(backup, null, 1));

  const touched = new Set<string>(); // 同じ既存顧客を2回書き換えない（控えが狂うため）
  for (const { plan, deals } of work) {
    if (deals.length === 0 && plan.target) continue;
    const dates = plan.rows.map((r) => ymDate(r.year_month)).sort((a, b) => a.getTime() - b.getTime());
    const wonDates = plan.rows.filter((r) => STATUS_MAP[r.status] === "CLOSED_WON").map((r) => ymDate(r.year_month)).sort((a, b) => a.getTime() - b.getTime());
    const lastWon = wonDates.at(-1);
    const status = lastWon ? (lastWon >= ACTIVE_SINCE ? "ACTIVE" : "INACTIVE") : "PROSPECT";
    const industry = plan.rows.map((r) => r.industry).find(Boolean) || null;
    const prefRaw = plan.rows.map((r) => r.prefecture).find((p) => PREFS.has(p)) || null;

    await db.$transaction(async (tx) => {
      let customerId: string;
      if (plan.target && touched.has(plan.target.id)) {
        customerId = plan.target.id; // 既に書き換え済み＝商談だけ足す
      } else if (plan.target) {
        const t = plan.target;
        touched.add(t.id);
        backup.updatedCustomers.push({ id: t.id, branchId: t.branchId, industry: t.industry, prefecture: t.prefecture, status: t.status, notes: t.notes, updatedAt: t.updatedAt });
        const rank: Record<string, number> = { PROSPECT: 0, INACTIVE: 1, ACTIVE: 2, BLOCKED: 3 };
        await tx.customer.update({
          where: { id: t.id },
          data: {
            branchId: HQ,
            industry: t.industry || industry,
            prefecture: t.prefecture || prefRaw,
            status: (rank[status] > rank[t.status] ? status : t.status) as "PROSPECT" | "ACTIVE" | "INACTIVE" | "BLOCKED",
            notes: [t.notes, `${MARK} 過去の商談を追加${t.branchId === ARCHIVE ? "（実績アーカイブから本部へ移動）" : ""}`].filter(Boolean).join("\n"),
          },
        });
        await tx.$executeRaw`UPDATE customers SET "updatedAt" = ${t.updatedAt} WHERE id = ${t.id}`;
        customerId = t.id;
      } else {
        const c = await tx.customer.create({
          data: {
            name: plan.client, industry, prefecture: prefRaw, status, branchId: HQ, source: "GMAIL_ARCHIVE",
            notes: `${MARK} で登録（2016〜2026のGmail等から抽出・代表目視済み）`,
          },
          select: { id: true },
        });
        await tx.$executeRaw`UPDATE customers SET "createdAt" = ${dates[0]}, "updatedAt" = ${dates.at(-1)!} WHERE id = ${c.id}`;
        backup.createdCustomerIds.push(c.id);
        customerId = c.id;
      }
      for (const r of deals) {
        const d = ymDate(r.year_month);
        const deal = await tx.deal.create({
          data: {
            title: maskAmounts(r.work).slice(0, 200), status: STATUS_MAP[r.status], closedAt: d, notes: dealNotes(r), closingFactor: closingFactor(r),
            customerId, branchId: HQ, assignedToId: owner.id, createdById: owner.id,
          },
          select: { id: true },
        });
        await tx.$executeRaw`UPDATE deals SET "createdAt" = ${d}, "updatedAt" = ${d} WHERE id = ${deal.id}`;
        backup.createdDealIds.push(deal.id);
      }
    }, { timeout: 60_000 });
    save();
  }
  save();
  console.log(`\n書き込み完了。控え（元に戻すとき使う）: ${backupPath}`);
}

export { maskNames, maskAmounts };
export const setNames = (xs: string[]) => { NAME_LIST = xs; };

if (!process.env.MASK_TEST) main()
  .catch((e) => { console.error("エラー:", e); process.exit(1); })
  .finally(() => db.$disconnect());
