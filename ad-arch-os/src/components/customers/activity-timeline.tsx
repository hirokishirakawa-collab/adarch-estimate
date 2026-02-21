import { cn } from "@/lib/utils";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/constants/crm";

type ActivityEntry = {
  id: string;
  type: string;
  content: string;
  staffName: string;
  createdAt: Date;
};

interface Props {
  activities: ActivityEntry[];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-zinc-400">活動履歴はまだありません</p>
        <p className="text-xs text-zinc-300 mt-1">
          上のフォームから最初の活動を記録しましょう
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 縦線 */}
      <div className="absolute left-[3.25rem] top-0 bottom-0 w-px bg-zinc-100" />

      <div className="divide-y divide-zinc-50">
        {activities.map((activity) => {
          const meta = ACTIVITY_TYPE_OPTIONS.find(
            (o) => o.value === activity.type
          );

          return (
            <div key={activity.id} className="flex gap-4 px-6 py-4 relative">
              {/* アイコン */}
              <div
                className={cn(
                  "relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-sm shadow-sm",
                  meta?.color.split(" ")[0] ?? "bg-zinc-100"
                )}
              >
                {meta?.icon ?? "📝"}
              </div>

              {/* コンテンツ */}
              <div className="flex-1 min-w-0 pt-0.5">
                {/* ヘッダー行 */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                      meta?.color ??
                        "bg-zinc-100 text-zinc-600 border-zinc-200"
                    )}
                  >
                    {meta?.icon} {meta?.label ?? activity.type}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {formatDate(activity.createdAt)}
                  </span>
                  <span className="text-[11px] font-medium text-zinc-500">
                    {activity.staffName}
                  </span>
                </div>

                {/* 活動内容 */}
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {activity.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
