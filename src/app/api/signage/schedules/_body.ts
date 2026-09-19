// 予定の入力値の整形。route.ts は Next の決まった名前（GET/POST/…）しか export できないため、
// 2つの route から使うこのヘルパーはここに置く
export function parseScheduleBody(b: Record<string, unknown>) {
  const hhmm = (v: unknown) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v : null);
  const toDate = (v: unknown) => (typeof v === "string" && v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);
  return {
    name: String(b.name ?? "").trim() || "標準",
    daysOfWeek: Array.isArray(b.daysOfWeek) ? [...new Set(b.daysOfWeek.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))] : [],
    startTime: hhmm(b.startTime),
    endTime: hhmm(b.endTime),
    startDate: toDate(b.startDate),
    endDate: toDate(b.endDate),
    priority: typeof b.priority === "number" ? Math.round(b.priority) : 0,
    isActive: b.isActive === undefined ? true : !!b.isActive,
  };
}
