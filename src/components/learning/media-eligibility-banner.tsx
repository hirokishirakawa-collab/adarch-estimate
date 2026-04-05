import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUseMedia, MEDIA_TYPE_LABELS } from "@/lib/learning-eligibility";
import type { MediaType } from "@/generated/prisma/client";
import { Lock, ArrowRight } from "lucide-react";

/**
 * 指定された媒体について、現在のログインユーザーが販売資格を持っているかチェックし、
 * 未取得の場合は警告バナーを表示するサーバーコンポーネント。
 *
 * 使い方:
 *   <MediaEligibilityBanner mediaType="TVER" />
 *
 * 資格免除ユーザー / 合格済みユーザー / 紐付けコース未定義 の場合は何も表示しない。
 */
export async function MediaEligibilityBanner({
  mediaType,
  variant = "warning",
}: {
  mediaType: MediaType;
  variant?: "warning" | "block";
}) {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return null;

  const eligible = await canUseMedia(user.id, mediaType);
  if (eligible) return null;

  const mediaLabel = MEDIA_TYPE_LABELS[mediaType] ?? mediaType;

  // 該当コースを案内用に取得
  const course = await db.learningCourse.findFirst({
    where: { mediaType, published: true },
    select: { id: true, title: true },
    orderBy: { sortOrder: "asc" },
  });

  const isBlock = variant === "block";

  return (
    <div
      className={`rounded-xl border p-4 mb-4 flex items-start gap-3 ${
        isBlock
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isBlock ? "bg-red-100" : "bg-amber-100"
        }`}
      >
        <Lock className={`w-4 h-4 ${isBlock ? "text-red-600" : "text-amber-600"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-bold ${isBlock ? "text-red-900" : "text-amber-900"}`}>
          「{mediaLabel}」の販売資格を取得していません
        </h3>
        <p className={`text-xs mt-1 ${isBlock ? "text-red-700" : "text-amber-700"}`}>
          {isBlock
            ? "このコースのテストに合格するまで、この媒体の見積を作成できません。"
            : "このまま進めることはできますが、テストに合格すると販売権限が付与されます。"}
        </p>
        {course && (
          <Link
            href={`/dashboard/learning/${course.id}`}
            className={`inline-flex items-center gap-1 mt-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              isBlock
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            }`}
          >
            「{course.title}」を受講する
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
