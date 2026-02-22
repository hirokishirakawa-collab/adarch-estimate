import { cn } from "@/lib/utils";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/constants/crm";

type DealLogEntry = {
  id: string;
  type: string;
  content: string;
  staffName: string;
  createdAt: Date;
};

interface Props {
  logs: DealLogEntry[];
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
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

function LogEntry({ log, isLast }: { log: DealLogEntry; isLast: boolean }) {
  const meta = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === log.type);

  return (
    <div className="flex gap-4">
      {/* アイコン + 縦ライン */}
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

      {/* コンテンツ */}
      <div className={cn("flex-1 min-w-0", isLast ? "pb-2" : "pb-5")}>
        <div className="bg-zinc-50 rounded-xl border border-zinc-100 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-zinc-100 bg-white">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                meta?.color ?? "bg-zinc-100 text-zinc-600 border-zinc-200"
              )}
            >
              {meta?.icon} {meta?.label ?? log.type}
            </span>
            <span className="text-[11px] text-zinc-400">{formatDate(log.createdAt)}</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {log.content}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border-t border-zinc-100 bg-white/60">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                avatarColor(log.staffName)
              )}
            >
              {getInitials(log.staffName)}
            </div>
            <span className="text-[11px] font-medium text-zinc-500">{log.staffName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DealLogTimeline({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-3xl mb-3">📋</p>
        <p className="text-sm text-zinc-400">活動記録はまだありません</p>
        <p className="text-xs text-zinc-300 mt-1">上のフォームから最初の活動を記録しましょう</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-5 space-y-0">
      {logs.map((log, i) => (
        <LogEntry key={log.id} log={log} isLast={i === logs.length - 1} />
      ))}
    </div>
  );
}
