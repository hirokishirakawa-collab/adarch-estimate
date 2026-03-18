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
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function getInitials(name: string): string {
  return name.slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ---------------------------------------------------------------
// システムログ用（変更履歴の自動ログ）— コンパクト表示
// ---------------------------------------------------------------
function SystemLogEntry({
  activity,
  isLast,
}: {
  activity: ActivityEntry;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4">
      {/* アイコン + 縦ライン */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="relative z-10 w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-base shadow-sm ring-1 ring-zinc-200">
          ⚙️
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-zinc-100 my-1" />}
      </div>

      {/* コンテンツ（横長コンパクト） */}
      <div className={cn("flex-1 min-w-0", isLast ? "pb-2" : "pb-4")}>
        <div className="flex flex-wrap items-center gap-2 py-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-500 border-slate-200">
            ⚙️ システム
          </span>
          <span className="text-[11px] text-zinc-400">
            {formatDate(activity.createdAt)}
          </span>
          <span className="text-xs text-zinc-600 flex-1">
            {activity.content}
          </span>
          <span className="text-[10px] text-zinc-400 ml-auto whitespace-nowrap">
            by {activity.staffName}
          </span>
        </div>
        {/* 下線 */}
        {!isLast && <div className="h-px bg-zinc-100" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// 通常ログ用（手動入力の活動メモ）
// ---------------------------------------------------------------
function ActivityEntry({
  activity,
  isLast,
}: {
  activity: ActivityEntry;
  isLast: boolean;
}) {
  const meta = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === activity.type);

  return (
    <div className="flex gap-4">
      {/* 左: アイコン + 縦ライン */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={cn(
            "relative z-10 w-10 h-10 rounded-full border-2 border-white",
            "flex items-center justify-center text-base shadow-sm ring-1 ring-zinc-200",
            meta ? meta.color.split(" ")[0] : "bg-zinc-100"
          )}
        >
          {meta?.icon ?? "📝"}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-zinc-100 my-1" />}
      </div>

      {/* 右: コンテンツカード */}
      <div className={cn("flex-1 min-w-0", isLast ? "pb-2" : "pb-5")}>
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 overflow-hidden">
          {/* カードヘッダー */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-zinc-100 bg-white">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                meta?.color ?? "bg-zinc-100 text-zinc-600 border-zinc-200"
              )}
            >
              {meta?.icon} {meta?.label ?? activity.type}
            </span>
            <span className="text-[11px] text-zinc-400 ml-0.5">
              {formatDate(activity.createdAt)}
            </span>
          </div>

          {/* 活動内容 */}
          <div className="px-4 py-3">
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {activity.content}
            </p>
          </div>

          {/* 作成者フッター */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-zinc-100 bg-white/60">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center",
                "text-[9px] font-bold flex-shrink-0",
                avatarColor(activity.staffName)
              )}
            >
              {getInitials(activity.staffName)}
            </div>
            <span className="text-[11px] font-medium text-zinc-500">
              {activity.staffName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// ActivityTimeline（メイン）
// ---------------------------------------------------------------
export function ActivityTimeline({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-3xl mb-3">📋</p>
        <p className="text-sm text-zinc-400">活動履歴はまだありません</p>
        <p className="text-xs text-zinc-300 mt-1">
          上のフォームから最初の活動を記録しましょう
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <div className="space-y-0">
        {activities.map((activity, index) => {
          const isLast = index === activities.length - 1;
          if (activity.type === "SYSTEM") {
            return (
              <SystemLogEntry
                key={activity.id}
                activity={activity}
                isLast={isLast}
              />
            );
          }
          return (
            <ActivityEntry
              key={activity.id}
              activity={activity}
              isLast={isLast}
            />
          );
        })}
      </div>
    </div>
  );
}
