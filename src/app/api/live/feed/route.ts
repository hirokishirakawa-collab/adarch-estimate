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
  LIVE_LEAD_LOG_WHERE,
  leadLogKind,
  leadLogText,
} from "@/lib/live/labels";
import { NextResponse } from "next/server";
import { buildPulseEvents, type PulseKind } from "@/lib/live/pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 90;
const MAX_EVENTS = 160;

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
    | "tender"
    | "lead"
    | PulseKind;
  actor: string; // 拠点名・会社名・「本部」
  prefs: string[];
  text: string;
  /** 押したときに詳細を引くための参照。無い種別はフィードの情報だけ出す */
  ref?: { kind: "deal" | "move" | "sent" | "tender" | "lead"; id: string };
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

  const [sent, deals, dealLogs, moves, bookings, tenders, leadLogs] =
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
      // リードの操作（取得・連絡・アポ・営業フォーム送付・返信あり）＝2026-09-09 代表選択。
      // 作成・クロール・プール投入・却下・自動の担当設定は流さない（数だけ多く、人の動きではない）。
      // detail の自由記述（送付本文・メモ）は出さない＝種別から文言を組む。
      db.leadLog.findMany({
        where: { createdAt: { gte: since }, ...LIVE_LEAD_LOG_WHERE },
        select: {
          id: true,
          createdAt: true,
          action: true,
          detail: true,
          staffName: true,
          lead: {
            select: {
              id: true,
              name: true,
              industry: true,
              area: true,
              prefecture: true,
              assignee: { select: { branch: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        // 一括操作が1回で10〜20件使うので多めに取る（畳んだ後は数行）
        take: 200,
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

  // ---- リードの操作 ----
  // 営業フォーム送付は、サイトURLがある相手だと送付台帳（sent）にも同じ1件が載る。
  // 台帳に載っている分はそちらに任せ、ここからは流さない（同じ送付が2行に見えないように）。
  const formSentLeadIds = leadLogs.filter((l) => l.action === "FORM_SENT").map((l) => l.lead.id);
  const inLedger = new Set(
    formSentLeadIds.length
      ? (
          await db.autoSalesSentDomain.findMany({
            where: { source: "LEAD_FORM", sourceId: { in: formSentLeadIds } },
            select: { sourceId: true },
          })
        ).map((r) => r.sourceId)
      : []
  );
  // 担当が付いていないリードは、操作した人の名前から拠点を引く（拠点の共有アカウントで操作することが多い）
  const staffNames = Array.from(
    new Set(leadLogs.filter((l) => !l.lead.assignee?.branch?.name).map((l) => l.staffName))
  );
  const staffUsers = staffNames.length
    ? await db.user.findMany({
        where: { OR: [{ name: { in: staffNames } }, { email: { in: staffNames } }] },
        select: { name: true, email: true, branch: { select: { name: true } } },
      })
    : [];
  const branchOfStaff = new Map<string, string>();
  for (const u of staffUsers) {
    if (!u.branch?.name) continue;
    if (u.name) branchOfStaff.set(u.name, u.branch.name);
    branchOfStaff.set(u.email, u.branch.name);
  }
  // 同じリードへ同じ操作を短時間に押し直した記録（連絡済み→未対応→連絡済み 等）は最新の1件だけ残し、
  // 同じ拠点が同じ操作を数分内に続けた分（一括操作で11社を「連絡済み」等）は1行に畳む＝フィードを埋めないため
  const seenLead = new Map<string, number>();
  type LeadGroup = { at: number; kind: ReturnType<typeof leadLogKind>; actor: string; leads: { id: string; name: string; industry: string | null; prefs: string[] }[] };
  const groups: LeadGroup[] = [];
  for (const l of leadLogs) {
    if (l.action === "FORM_SENT" && inLedger.has(l.lead.id)) continue;
    const kind = leadLogKind(l.action, l.detail);
    if (!kind) continue;
    const key = `${l.lead.id}:${kind}`;
    const t = l.createdAt.getTime();
    const prev = seenLead.get(key);
    if (prev !== undefined && prev - t < 30 * 60_000) continue;
    seenLead.set(key, t);
    const actor = l.lead.assignee?.branch?.name ?? branchOfStaff.get(l.staffName) ?? "グループ";
    const prefs = [...new Set([...prefsIn(actor), ...prefsIn(l.lead.prefecture ?? l.lead.area)])];
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && last.actor === actor && last.at - t < 5 * 60_000) {
      last.leads.push({ id: l.lead.id, name: l.lead.name, industry: l.lead.industry, prefs });
    } else {
      groups.push({ at: t, kind, actor, leads: [{ id: l.lead.id, name: l.lead.name, industry: l.lead.industry, prefs }] });
    }
  }
  for (const g of groups) {
    const head = g.leads[0];
    const who = `「${head.name}」${head.industry ? `（${head.industry}）` : ""}${g.leads.length > 1 ? `ほか${g.leads.length - 1}社` : ""}`;
    events.push({
      at: new Date(g.at).toISOString(),
      kind: "lead",
      actor: g.actor,
      prefs: [...new Set(g.leads.flatMap((x) => x.prefs))],
      text: leadLogText(g.kind!, who),
      ref: { kind: "lead", id: head.id },
    });
  }

  // 「脈」＝OSを使う・AIに聞く・OSが自動で見つける・お客様が見る（直近7日・2026-09-09）。
  // 人の営業の動き（上の各種）と同じ列に混ぜる。失敗しても本体は止めない
  let ai: { at: string; text: string }[] = [];
  try {
    const pulse = await buildPulseEvents({ days: 7 });
    for (const p of pulse.events) events.push(p);
    ai = pulse.ai.slice(0, 40); // AI ACTIVITY FEED（別枠・匿名・県なし）
  } catch (e) {
    console.error("[live/feed] pulse failed:", e instanceof Error ? e.message : e);
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
    const c = { approach: 0, deal: 0, won: 0, hq: 0, auto: 0, visit: 0 };
    for (const e of events.filter(pred)) {
      if (e.kind === "sent" || e.kind === "move" || e.kind === "log" || e.kind === "lead") c.approach++;
      else if (e.kind === "deal") c.deal++;
      // 加盟はこの面に出さない（数字にもフィードにも載せない＝2026-08-28 代表決定）
      else if (e.kind === "won") c.won++;
      // 脈は既存の4カウンタ（人の営業の動き）に混ぜない
      else if (e.kind === "auto") c.auto++;
      else if (e.kind === "visit") c.visit++;
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
    ai,
    counts: { today: countBy(today), week: countBy(in7d) },
    prefHeat,
    generatedAt: new Date().toISOString(),
  });
}
