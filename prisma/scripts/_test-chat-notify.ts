/**
 * テスト用: 応募資格のある企業にGoogle Chat通知を送信
 * 使い方: npx tsx prisma/scripts/_test-chat-notify.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url.replace(/\s+/g, "") });
const db = new PrismaClient({ adapter });

// --- getWeekId (group-support.ts と同じロジック) ---
function getWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// --- project-matching.ts と同じ定数 ---
const REQUIRED_WEEKS = 3;
const WEEKLY_GRACE_END = new Date("2026-03-30T00:00:00+09:00");
const REVENUE_GRACE_END = new Date("2026-04-01T00:00:00+09:00");

function getRequiredWeeks(now: Date): number {
  return now < WEEKLY_GRACE_END ? 1 : REQUIRED_WEEKS;
}
function isRevenueCheckActive(now: Date): boolean {
  return now >= REVENUE_GRACE_END;
}
function canApplyToProject(sub: number, rev: boolean, now: Date): boolean {
  return sub >= getRequiredWeeks(now) && (isRevenueCheckActive(now) ? rev : true);
}
function getLatestReportMonth(now: Date): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
}

// --- Webhook マップ ---
const WEBHOOK_MAP: Record<string, string> = {
  "AAQA1ONKAvc":"https://chat.googleapis.com/v1/spaces/AAQA1ONKAvc/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=IyULvaLMxRIWfve6Pq5_jBYNEENMgrdEg-jqQ-x0t_A",
  "AAQAtLNqdIc":"https://chat.googleapis.com/v1/spaces/AAQAtLNqdIc/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=7w7trOypKeQaYFup96XO5GL3tCpduHxLR8aH9RGbQE0",
  "AAQAZXqimA4":"https://chat.googleapis.com/v1/spaces/AAQAZXqimA4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=4Y21x9AWKkkjt5ZvxA_Kigab7cBqfi2FY8TwbPtIQQ4",
  "AAQA-qXB8rI":"https://chat.googleapis.com/v1/spaces/AAQA-qXB8rI/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=lrJEV3XZq-0uKMzlkOVGyY0W9AFn2yJDL7d3B61D7TI",
  "AAQALAC7WwY":"https://chat.googleapis.com/v1/spaces/AAQALAC7WwY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=yuqXz1ZMKTzskxzpaWthucEAVPVPis9LbeR-suBghG8",
  "AAQA5DWfLoE":"https://chat.googleapis.com/v1/spaces/AAQA5DWfLoE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=GswTHY28niSemwLsKN_Yojb_vVAGLqm3sXIldbXDE-s",
  "AAQAglZXyhE":"https://chat.googleapis.com/v1/spaces/AAQAglZXyhE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=zKntunJY-Yn6g5WvdnWW99pO-z_u54Hw3MCbON1nWPY",
  "AAQAAUnoJwE":"https://chat.googleapis.com/v1/spaces/AAQAAUnoJwE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=C6MQKiOb3xQDwlXe45-XJ54iPrPcv8kr5L1xbaf5JiA",
  "AAQAWNECvr8":"https://chat.googleapis.com/v1/spaces/AAQAWNECvr8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Ow-ysSHiTYuWimVskA3uzFeHEzDonadnDcD-YXMky74",
  "AAQAkbYR4II":"https://chat.googleapis.com/v1/spaces/AAQAkbYR4II/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mDCX2UzEhXqqTUVs4kZ1qMfHgZyTtQjnGeo38Q6_01k",
  "AAQAT2_JOrs":"https://chat.googleapis.com/v1/spaces/AAQAT2_JOrs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=hM_nk1o2F2pYx-j55bgiiVo5tNCusgfVVpko-mFR_ow",
  "AAQAn5FvUIA":"https://chat.googleapis.com/v1/spaces/AAQAn5FvUIA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=QenZD9hclXTAGpSeM53iR3qhCf6bqIGFAu2XNCDKyXk",
  "AAQAKs7kuos":"https://chat.googleapis.com/v1/spaces/AAQAKs7kuos/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mcfjQqVhD0DDZa7PCRbS4lzMLQcQzP-sBggsfeoyFYk",
  "AAQAc-b0LvA":"https://chat.googleapis.com/v1/spaces/AAQAc-b0LvA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=-Af_C7dv6GBcsqKWFxP6k7zOI78r67K9zYme3rjLaOI",
  "AAQAh8Wku14":"https://chat.googleapis.com/v1/spaces/AAQAh8Wku14/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=yMdEJ_tVU09DPDAwn4QFsUKC_gh4u-Sx_H4bi73W_ho",
  "AAQAsGlKn5c":"https://chat.googleapis.com/v1/spaces/AAQAsGlKn5c/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=aDzEeeujsGbo7_rh3xCc7jck1kc1_r1R4HF7ByjkBi8",
  "AAQAAUMlEc4":"https://chat.googleapis.com/v1/spaces/AAQAAUMlEc4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mvY69atxkeWdAqyPx6voR8jJqDVdIMI5y8dgjJMIAw4",
  "AAQAxtfQtSs":"https://chat.googleapis.com/v1/spaces/AAQAxtfQtSs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=WxTDMxbb6zzxfGIGjVQ_tPLP9ARXOZFPdJslB07FqHM",
  "AAQARP8u-EQ":"https://chat.googleapis.com/v1/spaces/AAQARP8u-EQ/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=MWjswOf47E1I1-u3oSt62iM71PPFjInyspxD51a6YIs",
  "AAQAR7L5Y0k":"https://chat.googleapis.com/v1/spaces/AAQAR7L5Y0k/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=CYgBJxe_ycUzN43ZTPVfG-GEQQsHjd3tCGaYmsnXMZ0",
  "AAQAbXme2Us":"https://chat.googleapis.com/v1/spaces/AAQAbXme2Us/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=cXNW9zxwUR9N7jCw6SlAVXzt2U3iB3-G28PXhgsXWVQ",
  "AAQA3TuKvwk":"https://chat.googleapis.com/v1/spaces/AAQA3TuKvwk/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=IvfkkOscerzcXBSKL0whwIsQ7MypeAV-wcTu495kU48",
  "AAQAQiXsCUw":"https://chat.googleapis.com/v1/spaces/AAQAQiXsCUw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=FXCVkmbKf383WQ1nna3qC-_LCf6Q6xmFarGdiJXs5ks",
  "AAQAoR3gb1M":"https://chat.googleapis.com/v1/spaces/AAQAoR3gb1M/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=7HcUwZisCB73b3B0uOPip88y8QSxEQRxQZ80OzhXxBs",
  "AAQAmDz98iM":"https://chat.googleapis.com/v1/spaces/AAQAmDz98iM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=w482FGLLydLrWRDA0-EFwwyeKtUuj5z372RZMXXkjGs",
  "AAQACGzXMPM":"https://chat.googleapis.com/v1/spaces/AAQACGzXMPM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=71-Juuzn6nN0-t9eKeYmhpCvcsfK4-9eSWcF_KUk21Y",
};

async function main() {
  const now = new Date();
  const requiredWeeks = getRequiredWeeks(now);
  const revenueActive = isRevenueCheckActive(now);
  const targetMonth = getLatestReportMonth(now);

  const weekIds: string[] = [];
  for (let i = 0; i < REQUIRED_WEEKS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekIds.push(getWeekId(d));
  }

  console.log(`判定条件: 週次シェア ${requiredWeeks}週以上, 売上報告チェック: ${revenueActive ? "有効" : "免除中"}`);
  console.log(`対象weekIds: ${weekIds.join(", ")}\n`);

  const companies = await db.groupCompany.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      chatSpaceId: true,
      linkedUsers: { select: { branchId: true }, take: 1 },
      weeklySubmissions: {
        where: { weekId: { in: weekIds } },
        select: { weekId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const eligible: typeof companies = [];
  const ineligible: typeof companies = [];

  for (const c of companies) {
    const sub = c.weeklySubmissions.length;
    const branchId = c.linkedUsers[0]?.branchId ?? null;
    let hasRevenue = true;
    if (revenueActive && branchId) {
      hasRevenue = (await db.revenueReport.count({ where: { branchId, targetMonth } })) > 0;
    } else if (revenueActive && !branchId) {
      hasRevenue = false;
    }
    if (canApplyToProject(sub, hasRevenue, now)) {
      eligible.push(c);
    } else {
      ineligible.push(c);
    }
  }

  console.log(`応募可能: ${eligible.length}社`);
  eligible.forEach(c => console.log(`  ✅ ${c.name} (${c.chatSpaceId})`));
  console.log(`\n条件未達: ${ineligible.length}社`);
  ineligible.forEach(c => console.log(`  ❌ ${c.name}`));

  // 応募可能な企業にテスト通知を送信
  const message = [
    "📢 【テスト通知】案件マッチング機能",
    "",
    "この通知が届いた方は、現在の応募条件を満たしています。",
    "今後、新しい案件が投稿された際にこのスペースに通知が届きます。",
    "",
    "※ これはシステムの動作確認用テストメッセージです。",
  ].join("\n");

  console.log(`\n--- 送信開始 (${eligible.length}社) ---`);

  let sent = 0;
  let failed = 0;
  for (const c of eligible) {
    const key = c.chatSpaceId.replace(/^spaces\//, "");
    const webhookUrl = WEBHOOK_MAP[key];
    if (!webhookUrl) {
      console.log(`  ⚠️  ${c.name}: Webhook URL なし (${c.chatSpaceId})`);
      failed++;
      continue;
    }
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (res.ok) {
        console.log(`  ✅ ${c.name}: 送信成功`);
        sent++;
      } else {
        console.log(`  ❌ ${c.name}: HTTP ${res.status}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ❌ ${c.name}: ${e}`);
      failed++;
    }
  }

  console.log(`\n完了: ${sent} 送信, ${failed} 失敗`);
  await db.$disconnect();
}

main().catch(console.error);
