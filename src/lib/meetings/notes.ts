// ==============================================================
// 会議メモ（Web会議・訪問の要約）— 守秘と共有の二段構え（2026-09-16 代表決定）
//   原文（社名・相手の発言・宿題）＝書いた人／本部／指名した人だけ
//   匿名版（社名・人名なし。気にしている点・刺さった点だけ）＝公開範囲 GROUP のとき全社
//   ⚠️ 金額は持たない・出さない。相手先名は匿名版から機械的にも伏せる。
// ==============================================================

import { db } from "@/lib/db";
import type { MeetingVisibility } from "@/generated/prisma/client";

export const MEETING_SOURCE_OPTIONS = [
  { value: "ZOOM", label: "Zoom" },
  { value: "MEET", label: "Google Meet" },
  { value: "TEAMS", label: "Teams" },
  { value: "VISIT", label: "訪問" },
  { value: "PHONE", label: "電話" },
  { value: "OTHER", label: "その他" },
] as const;

export const MEETING_VISIBILITY_OPTIONS: { value: MeetingVisibility; label: string; desc: string }[] = [
  { value: "PRIVATE", label: "自分と本部だけ", desc: "原文も匿名版も外に出しません" },
  { value: "ALLOWED", label: "指名した人まで", desc: "指名した人に原文を開きます（全社には出ません）" },
  { value: "GROUP", label: "匿名版を全社に出す", desc: "社名・人名を伏せた要点だけ全社に出し、原文は指名した人まで" },
];

export const sourceLabel = (v: string) => MEETING_SOURCE_OPTIONS.find((o) => o.value === v)?.label ?? v;
export const visibilityLabel = (v: MeetingVisibility) => MEETING_VISIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v;

export interface MeetingViewer {
  email: string;
  role: "ADMIN" | "MANAGER" | "USER";
}

/** DBから取る1件（表示前の素の形） */
export interface MeetingRow {
  id: string;
  title: string;
  meetingAt: Date;
  durationMin: number | null;
  source: string;
  customerId: string | null;
  dealId: string | null;
  branchId: string | null;
  counterpart: string | null;
  industry: string | null;
  prefecture: string | null;
  summary: string;
  concerns: string[];
  winPoints: string[];
  objections: string[];
  nextActions: string[];
  sharedSummary: string | null;
  visibility: MeetingVisibility;
  allowedEmails: string[];
  createdByEmail: string;
  createdByName: string;
}

/** 原文（社名・相手の発言・宿題・次の一手）を開けるか。本部・書いた人・指名された人だけ */
export function canReadFull(viewer: MeetingViewer, note: Pick<MeetingRow, "createdByEmail" | "allowedEmails">): boolean {
  if (viewer.role === "ADMIN") return true;
  if (note.createdByEmail.toLowerCase() === viewer.email.toLowerCase()) return true;
  return note.allowedEmails.some((e) => e.toLowerCase() === viewer.email.toLowerCase());
}

/** その1件が一覧に出てよいか（匿名版だけ見える人を含む） */
export function canRead(viewer: MeetingViewer, note: Pick<MeetingRow, "createdByEmail" | "allowedEmails" | "visibility">): boolean {
  return note.visibility === "GROUP" || canReadFull(viewer, note);
}

const MASK = "◯◯";
/** 匿名版に混ざった相手先名を機械的に伏せる（書き手が書いてしまった場合の保険） */
function maskNames(text: string, names: (string | null | undefined)[]): string {
  let out = text;
  for (const n of names) {
    const name = n?.trim();
    if (!name || name.length < 2) continue;
    out = out.split(name).join(MASK);
  }
  return out;
}

/** 画面に渡す形。full=false のときは原文の項目を落とす */
export interface MeetingView {
  id: string;
  full: boolean;
  title: string;
  meetingAt: Date;
  durationMin: number | null;
  source: string;
  industry: string | null;
  prefecture: string | null;
  visibility: MeetingVisibility;
  author: string;
  authorEmail: string | null;
  allowedEmails: string[];
  customerId: string | null;
  customerName: string | null;
  dealId: string | null;
  counterpart: string | null;
  summary: string | null;
  sharedSummary: string | null;
  concerns: string[];
  winPoints: string[];
  objections: string[];
  nextActions: string[];
}

function toView(viewer: MeetingViewer, note: MeetingRow, customerName: string | null): MeetingView {
  const full = canReadFull(viewer, note);
  const names = [customerName, note.counterpart];
  return {
    id: note.id,
    full,
    // 匿名版では会議名にも社名が入るので伏せる
    title: full ? note.title : maskNames(note.title, names),
    meetingAt: note.meetingAt,
    durationMin: note.durationMin,
    source: note.source,
    industry: note.industry,
    prefecture: note.prefecture,
    visibility: note.visibility,
    author: full ? note.createdByName : "グループの誰か",
    authorEmail: full ? note.createdByEmail : null,
    allowedEmails: full ? note.allowedEmails : [],
    customerId: full ? note.customerId : null,
    customerName: full ? customerName : null,
    dealId: full ? note.dealId : null,
    counterpart: full ? note.counterpart : null,
    summary: full ? note.summary : null,
    sharedSummary: note.sharedSummary ? maskNames(note.sharedSummary, names) : null,
    concerns: note.concerns.map((t) => (full ? t : maskNames(t, names))),
    winPoints: note.winPoints.map((t) => (full ? t : maskNames(t, names))),
    // 宿題・次の一手は自拠点の動き＝原文を開ける人だけ
    objections: full ? note.objections : [],
    nextActions: full ? note.nextActions : [],
  };
}

const SELECT = {
  id: true, title: true, meetingAt: true, durationMin: true, source: true,
  customerId: true, dealId: true, branchId: true, counterpart: true,
  industry: true, prefecture: true, summary: true, concerns: true, winPoints: true,
  objections: true, nextActions: true, sharedSummary: true, visibility: true,
  allowedEmails: true, createdByEmail: true, createdByName: true,
} as const;

async function customerNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map();
  const rows = await db.customer.findMany({ where: { id: { in: list } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** 自分に見える会議メモの一覧（新しい順） */
export async function listMeetingNotes(viewer: MeetingViewer, take = 100): Promise<MeetingView[]> {
  const where =
    viewer.role === "ADMIN"
      ? {}
      : {
          OR: [
            { createdByEmail: viewer.email },
            { allowedEmails: { has: viewer.email } },
            { visibility: "GROUP" as MeetingVisibility },
          ],
        };
  const rows = await db.meetingNote.findMany({ where, select: SELECT, orderBy: { meetingAt: "desc" }, take });
  const names = await customerNames(rows.map((r) => r.customerId));
  return rows.map((r) => toView(viewer, r, r.customerId ? names.get(r.customerId) ?? null : null));
}

/** 1件。見えない人には null（詳細ページ側でも必ずこの関数を通す） */
export async function getMeetingNote(viewer: MeetingViewer, id: string): Promise<MeetingView | null> {
  const row = await db.meetingNote.findUnique({ where: { id }, select: SELECT });
  if (!row || !canRead(viewer, row)) return null;
  const names = await customerNames([row.customerId]);
  return toView(viewer, row, row.customerId ? names.get(row.customerId) ?? null : null);
}
