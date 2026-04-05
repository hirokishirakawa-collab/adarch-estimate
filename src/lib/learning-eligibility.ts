import { db } from "@/lib/db";
import type { MediaType } from "@/generated/prisma/client";

/**
 * 指定ユーザーが特定媒体の販売資格を持っているか判定する。
 *
 * 判定ロジック:
 *   1. `User.learningExempt = true`（既存加盟者）→ 常にtrue
 *   2. その媒体に紐付く LearningCourse のテストに全て合格している → true
 *   3. コース/テストが未定義の媒体は true（制御対象外）
 */
export async function canUseMedia(userId: string, mediaType: MediaType): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { learningExempt: true },
  });
  if (!user) return false;
  if (user.learningExempt) return true;

  const courses = await db.learningCourse.findMany({
    where: { mediaType, published: true },
    include: { tests: { select: { id: true } } },
  });
  if (courses.length === 0) return true; // 紐付け無し=制御対象外

  const testIds = courses.flatMap((c) => c.tests.map((t) => t.id));
  if (testIds.length === 0) return true; // テスト未設定=制御対象外

  const passed = await db.learningAttempt.count({
    where: { userId, testId: { in: testIds }, passed: true },
  });
  return passed >= testIds.length;
}

/**
 * ユーザーが販売可能な媒体の一覧を返す。
 * 免除ユーザーは全MediaTypeを返す（運用では使う側で必要に応じてフィルタ）。
 */
export async function listUsableMediaTypes(userId: string): Promise<MediaType[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { learningExempt: true },
  });
  if (!user) return [];

  const gatedCourses = await db.learningCourse.findMany({
    where: { published: true, mediaType: { not: null } },
    include: { tests: { select: { id: true } } },
  });

  // 媒体ごとに必要なテストIDをまとめる
  const requiredByMedia = new Map<MediaType, Set<string>>();
  for (const c of gatedCourses) {
    if (!c.mediaType) continue;
    if (!requiredByMedia.has(c.mediaType)) requiredByMedia.set(c.mediaType, new Set());
    for (const t of c.tests) requiredByMedia.get(c.mediaType)!.add(t.id);
  }

  if (user.learningExempt) {
    return Array.from(requiredByMedia.keys());
  }

  const passedAttempts = await db.learningAttempt.findMany({
    where: { userId, passed: true },
    select: { testId: true },
  });
  const passedSet = new Set(passedAttempts.map((a) => a.testId));

  const usable: MediaType[] = [];
  for (const [media, required] of requiredByMedia.entries()) {
    if (required.size === 0) continue;
    const allPassed = Array.from(required).every((id) => passedSet.has(id));
    if (allPassed) usable.push(media);
  }
  return usable;
}

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  TVER: "TVer",
  CINE_AD: "シネアド（イオンシネマ）",
  DIGITAL_SIGNAGE: "デジタルサイネージ",
  TAXI: "タクシー広告",
  APA_HOTEL: "アパホテル",
  UNIVERSITY: "大学広告",
  SKYLARK: "すかいらーく広告",
  GOLF_CART: "ゴルフカート",
  ACQUISITION: "取得依頼",
  OTHER: "その他",
};
