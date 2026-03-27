import type { ProjectLog, ProjectLogType } from "@/generated/prisma/client";

// ---------------------------------------------------------------
// ログタイプ設定
// ---------------------------------------------------------------
const LOG_TYPE_CONFIG: Record<
  ProjectLogType,
  { icon: string; label: string; compact: boolean; color: string }
> = {
  SYSTEM:          { icon: "⚙️", label: "システム",  compact: true,  color: "text-slate-500" },
  NOTE:            { icon: "📝", label: "メモ",      compact: false, color: "text-zinc-600" },
  MEETING:         { icon: "🤝", label: "商談・会議", compact: false, color: "text-blue-600" },
  EXPENSE_ADDED:   { icon: "💴", label: "経費追加",  compact: true,  color: "text-emerald-600" },
  EXPENSE_DELETED: { icon: "🗑", label: "経費削除",  compact: true,  color: "text-red-500" },
};

// ---------------------------------------------------------------
// 日時フォーマット
// ---------------------------------------------------------------
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day:   "numeric",
    hour:  "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(date));
}

// ---------------------------------------------------------------
// コンパクトログ行（SYSTEM / EXPENSE_ADDED / EXPENSE_DELETED）
// ---------------------------------------------------------------
function CompactLogEntry({ log }: { log: ProjectLog }) {
  const config = LOG_TYPE_CONFIG[log.type];
  return (
    <div className="flex items-start gap-2 py-2 px-3 bg-zinc-50 rounded-lg border border-zinc-100">
      <span className="text-sm flex-shrink-0 mt-0.5">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${config.color} whitespace-pre-wrap`}>{log.content}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[10px] text-zinc-400">{formatDateTime(log.createdAt)}</p>
        <p className="text-[10px] text-zinc-400">{log.staffName}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// フルカードログ（NOTE）
// ---------------------------------------------------------------
function NoteLogEntry({ log }: { log: ProjectLog }) {
  const initial = log.staffName?.[0]?.toUpperCase() ?? "?";
  const config = LOG_TYPE_CONFIG[log.type];
  const isMeeting = log.type === "MEETING";
  return (
    <div className="flex gap-3">
      {/* アバター */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
        isMeeting ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
      }`}>
        {initial}
      </div>
      {/* カード */}
      <div className={`flex-1 rounded-lg border px-4 py-3 shadow-sm ${
        isMeeting ? "bg-blue-50/50 border-blue-200" : "bg-white border-zinc-200"
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{config.icon}</span>
            <span className="text-xs font-semibold text-zinc-700">{log.staffName}</span>
            {isMeeting && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold">商談・会議</span>
            )}
          </div>
          <span className="text-[10px] text-zinc-400">{formatDateTime(log.createdAt)}</span>
        </div>
        <p className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">{log.content}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// タイムライン本体
// ---------------------------------------------------------------
interface Props {
  logs: ProjectLog[];
}

export function ProjectLogTimeline({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-zinc-400 text-center py-8">
        ログはまだありません
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const config = LOG_TYPE_CONFIG[log.type];
        if (config.compact) {
          return <CompactLogEntry key={log.id} log={log} />;
        }
        return <NoteLogEntry key={log.id} log={log} />;
      })}
    </div>
  );
}
