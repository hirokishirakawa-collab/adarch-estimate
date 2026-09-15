"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMailsuiteLine, recordMailTracking, type MailTrackingResult } from "@/lib/outreach/mail-tracking";

// ---------------------------------------------------------------
// 「送った営業文」の貼り付け欄から、MailSuite 通知の件名をまとめて登録する
//   AIを使わない人向け。Gmail の通知の件名を1行ずつ貼る（日時は分からないので登録時刻で入る）
// ---------------------------------------------------------------
export async function registerMailTrackingText(
  text: string,
): Promise<{ error?: string; parsed?: number; unreadable?: number; result?: MailTrackingResult }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "ログインが必要です" };
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!user) return { error: "ユーザーが見つかりません" };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 200);
  const items = lines.map(parseMailsuiteLine).filter((x): x is NonNullable<typeof x> => x !== null);
  if (items.length === 0) {
    return { error: "MailSuiteの通知の件名が読み取れませんでした（例: info@example.co.jpが「件名」を読みました）" };
  }
  const result = await recordMailTracking(user, items);
  revalidatePath("/dashboard/outreach-messages");
  return { parsed: items.length, unreadable: lines.length - items.length, result };
}
