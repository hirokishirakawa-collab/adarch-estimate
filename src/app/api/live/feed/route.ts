// ==============================================================
// GET /api/live/feed — グループ稼働ライブボードのイベントフィード
//
//   「今どこの代表が、どの会社（業界）に、どう当たっているか」を
//   既存テーブルから自動で組み立てる。パートナーの追加入力はゼロ。
//
//   ⚠️ 金額はどのイベントにも出さない（社名・業界・段階まで）。
//   ⚠️ 商談ログの自由記述（content）は出さない＝種別ラベルだけ。
// ==============================================================

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEAL_STATUS_LABEL,
  ACTIVITY_LABEL,
  MOVE_STAGE_LABEL,
  MOVE_METHOD_LABEL,
} from "@/lib/live/labels";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 90;
const MAX_EVENTS = 120;

// 都道府県名の抽出（拠点名「香川・岡山」「東京（片桐）」等から拾う）
const PREFS = [
  "北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬",
  "埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野",
  "岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山",
  "鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡",
  "佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄",
];
function prefsIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return PREFS.filter((p) => text.includes(p));
}


export interface LiveEvent {
  at: string; // ISO
  kind:
    | "sent"
    | "deal"
    | "won"
    | "log"
    | "move"
    | "booking"
    | "tender";
  actor: string; // 拠点名・会社名・「本部」
  prefs: string[];
  text: string;
  /** 押したときに詳細を引くための参照。無い種別はフィードの情報だけ出す */
  ref?: { kind: "deal" | "move" | "sent" | "tender"; id: string };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // 全社名が流れる画面のため、デモアカウントと停止中ユーザーには出さない。
  // （加盟代表どうしで全拠点の動きを見合うのは仕様＝2026-08-24 代表決定）
  if (session.user.email === "demo@adarch.co.jp" || session.user.isActive === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);

  const [sent, deals, dealLogs, moves, bookings, tenders] =
    await Promise.all([
      db.autoSalesSentDomain.findMany({
        where: { sentAt: { gte: since } },
        select: { id: true, sentAt: true, companyName: true, hasResponse: true, branch: { select: { name: true } } },
        orderBy: { sentAt: "desc" },
        take: 40,
      }),
      db.deal.findMany({
        where: { updatedAt: { gte: since } },
        select: {
          id: true,
          updatedAt: true,
          createdAt: true,
          status: true,
          customer: { select: { name: true, industry: true, prefecture: true } },
          branch: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
      }),
      db.dealLog.findMany({
        where: { createdAt: { gte: since }, type: { not: "SYSTEM" } },
        select: {
          createdAt: true,
          type: true,
          deal: {
            select: {
              id: true,
              customer: { select: { name: true, industry: true } },
              branch: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.groupMove.findMany({
        where: { movedAt: { gte: since } },
        select: {
          id: true,
          movedAt: true,
          industry: true,
          method: true,
          stage: true,
          companyName: true,
          groupCompany: { select: { name: true, prefecture: true } },
        },
        orderBy: { movedAt: "desc" },
        take: 30,
      }),
      // 本部宛ての予約はこの面に出さない（加盟面談が混じるため＝2026-08-28 代表決定）。
      // 拠点のLINEアカウントから作られたホストの予約＝拠点自身の商談だけを流す。
      db.booking.findMany({
        where: {
          createdAt: { gte: since },
          status: "CONFIRMED",
          host: { lineAccountId: { not: null } },
        },
        select: {
          createdAt: true,
          company: true,
          host: { select: { lineAccountId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.tender.findMany({
        where: { fitCheckedAt: { gte: since }, fit: "MATCH" },
        select: {
          id: true,
          fitCheckedAt: true,
          projectName: true,
          organizationName: true,
          prefectureName: true,
        },
        orderBy: { fitCheckedAt: "desc" },
        take: 20,
      }),
    ]);

  const events: LiveEvent[] = [];

  for (const s of sent) {
    events.push({
      at: s.sentAt.toISOString(),
      kind: "sent",
      actor: s.branch.name,
      prefs: prefsIn(s.branch.name),
      text: `「${s.companyName}」へ初回コンタクトを送付${s.hasResponse ? "（反響あり）" : ""}`,
      ref: { kind: "sent", id: s.id },
    });
  }
  for (const d of deals) {
    const ind = d.customer.industry ? `${d.customer.industry}` : "";
    const isNew = d.updatedAt.getTime() - d.createdAt.getTime() < 60_000;
    const won = d.status === "CLOSED_WON";
    events.push({
      at: d.updatedAt.toISOString(),
      kind: won ? "won" : "deal",
      actor: d.branch.name,
      prefs: [...new Set([...prefsIn(d.branch.name), ...prefsIn(d.customer.prefecture)])],
      text: won
        ? `「${d.customer.name}」${ind ? `（${ind}）` : ""}を受注`
        : isNew
          ? `「${d.customer.name}」${ind ? `（${ind}）` : ""}との商談を開始`
          : `「${d.customer.name}」${ind ? `（${ind}）` : ""}の商談を「${DEAL_STATUS_LABEL[d.status] ?? d.status}」へ`,
      ref: { kind: "deal", id: d.id },
    });
  }
  for (const l of dealLogs) {
    const ind = l.deal.customer.industry;
    events.push({
      at: l.createdAt.toISOString(),
      kind: "log",
      actor: l.deal.branch.name,
      prefs: prefsIn(l.deal.branch.name),
      text: `「${l.deal.customer.name}」${ind ? `（${ind}）` : ""}に${ACTIVITY_LABEL[l.type] ?? "フォロー"}`,
      ref: { kind: "deal", id: l.deal.id },
    });
  }
  for (const m of moves) {
    const method = MOVE_METHOD_LABEL[m.method] ?? "";
    events.push({
      at: m.movedAt.toISOString(),
      kind: "move",
      actor: m.groupCompany.name,
      prefs: prefsIn(m.groupCompany.prefecture),
      // 会社名が入っていれば商談と同じ見え方に揃える（ライブは社名を出す面）
      text: m.companyName
        ? `「${m.companyName}」（${m.industry}）に${method ? `${method}で` : ""}アプローチ — ${MOVE_STAGE_LABEL[m.stage] ?? m.stage}`
        : `${m.industry}に${method ? `${method}で` : ""}アプローチ — ${MOVE_STAGE_LABEL[m.stage] ?? m.stage}`,
      ref: { kind: "move", id: m.id },
    });
  }
  // 予約ホストの LINE アカウントは Prisma のリレーションを張っていないので、
  // 拠点名を出すぶんだけ後から引く（該当が無いときは問い合わせない）。
  const lineAccountIds = Array.from(
    new Set(bookings.map((b) => b.host.lineAccountId).filter((id): id is string => !!id))
  );
  const lineAccounts = lineAccountIds.length
    ? await db.lineAccount.findMany({
        where: { id: { in: lineAccountIds } },
        select: { id: true, branch: { select: { name: true } } },
      })
    : [];
  const branchOfLineAccount = new Map(
    lineAccounts.map((a) => [a.id, a.branch?.name ?? null])
  );
  for (const b of bookings) {
    const branchName = b.host.lineAccountId
      ? branchOfLineAccount.get(b.host.lineAccountId)
      : null;
    // 拠点が特定できないもの（本部のLINEアカウント）は出さない
    if (!branchName) continue;
    events.push({
      at: b.createdAt.toISOString(),
      kind: "booking",
      actor: branchName,
      prefs: [],
      text: `${b.company ? `「${b.company}」から` : ""}面談予約が入りました`,
    });
  }
  for (const t of tenders) {
    if (!t.fitCheckedAt) continue;
    events.push({
      at: t.fitCheckedAt.toISOString(),
      kind: "tender",
      actor: "入札ファインダー",
      prefs: prefsIn(t.prefectureName),
      text: `${t.organizationName ?? ""}「${t.projectName.slice(0, 40)}${t.projectName.length > 40 ? "…" : ""}」を○判定`,
      ref: { kind: "tender", id: t.id },
    });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  const top = events.slice(0, MAX_EVENTS);

  // 集計（今日・7日）
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const in7d = (e: LiveEvent) => now - Date.parse(e.at) < 7 * 86400000;
  const today = (e: LiveEvent) => Date.parse(e.at) >= dayStart.getTime();
  const countBy = (pred: (e: LiveEvent) => boolean) => {
    const c = { approach: 0, deal: 0, won: 0, hq: 0 };
    for (const e of events.filter(pred)) {
      if (e.kind === "sent" || e.kind === "move" || e.kind === "log") c.approach++;
      else if (e.kind === "deal") c.deal++;
      // 加盟はこの面に出さない（数字にもフィードにも載せない＝2026-08-28 代表決定）
      else if (e.kind === "won") c.won++;
      else c.hq++;
    }
    return c;
  };

  // 都道府県ごとの直近活動（地図の光り方に使う: 経過ミリ秒が小さいほど熱い）
  const prefHeat: Record<string, number> = {};
  for (const e of events) {
    const age = now - Date.parse(e.at);
    for (const p of e.prefs) {
      if (!(p in prefHeat) || age < prefHeat[p]) prefHeat[p] = age;
    }
  }

  return NextResponse.json({
    events: top,
    counts: { today: countBy(today), week: countBy(in7d) },
    prefHeat,
    generatedAt: new Date().toISOString(),
  });
}
