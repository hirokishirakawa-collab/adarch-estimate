// ---------------------------------------------------------------
// グループの動きボード
//   「誰が今どの業界に、どう当たって、どこまで進んでいるか」を拠点ごとに並べる。
//
//   主な材料は商談（Deal）。加盟代表が普段どおり商談を動かすだけで、
//   何も書かなくてもボードに出る＝入力ゼロで公開されるのが狙い。
//   商談に載らない動き（紹介・飛び込み・既存客）は GroupMove で1件足せる。
//
//   ⚠️ 金額（Deal.amount）と顧客名（Deal.title / Customer.name）は
//      ここから外に出さない。出すのは 業界 / 当たり方 / 段階 / 一言 だけ。
// ---------------------------------------------------------------
import { db } from "@/lib/db";
import type { GroupMoveStage } from "@/generated/prisma/client";
import { stageFromDealStatus, normalizeIndustry } from "@/lib/constants/group-move";

/** ボードに出す期間。これより古い動きは「今」ではないので出さない */
export const WINDOW_DAYS = 90;

export interface BoardMove {
  id: string;
  source: "DEAL" | "MANUAL";
  industry: string;
  /** 当たり方。商談には持たせていないので null になる */
  method: string | null;
  stage: GroupMoveStage;
  note: string | null;
  movedAt: Date;
  /** 自分の拠点の動きか（段階ボタンを出してよいか） */
  editable: boolean;
}

export interface BoardCard {
  companyId: string;
  companyName: string;
  prefecture: string | null;
  emoji: string | null;
  moves: BoardMove[];
  monthCount: number; // 今月動いた件数（見送りは数えない）
  wonCount: number; // 今月の受注
  lastMovedAt: Date | null;
  isMine: boolean;
}

export interface Board {
  cards: BoardCard[];
  /** 動きが1件も無い拠点（カードの下にまとめて薄く出す） */
  quietCompanies: { companyId: string; companyName: string; isMine: boolean }[];
  totalMoves: number;
  totalWon: number;
  activeCompanies: number;
  /** 業界ごとの件数（多い順）。絞り込みチップに使う */
  industries: { name: string; count: number }[];
  monthLabel: string;
}

function monthStart(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getMoveBoard(opts: {
  /** 見ている人の加盟会社（自分の動きに段階ボタンを出すため） */
  myCompanyId: string | null;
  industry?: string;
  stage?: string;
}): Promise<Board> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const mStart = monthStart();

  const [companies, users, deals, manualMoves] = await Promise.all([
    db.groupCompany.findMany({
      where: { isActive: true },
      select: { id: true, name: true, prefecture: true, emoji: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ select: { id: true, groupCompanyId: true } }),
    db.deal.findMany({
      where: {
        updatedAt: { gte: since },
        status: { notIn: ["DORMANT", "DEFERRED"] },
      },
      // 金額・タイトルはここで取らない（取らなければ画面へ漏れようがない）
      select: {
        id: true,
        status: true,
        updatedAt: true,
        assignedToId: true,
        createdById: true,
        customer: { select: { industry: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.groupMove.findMany({
      where: { movedAt: { gte: since } },
      select: {
        id: true,
        groupCompanyId: true,
        industry: true,
        method: true,
        stage: true,
        note: true,
        movedAt: true,
      },
      orderBy: { movedAt: "desc" },
    }),
  ]);

  const companyOfUser = new Map<string, string | null>();
  for (const u of users) companyOfUser.set(u.id, u.groupCompanyId);

  const byCompany = new Map<string, BoardMove[]>();
  const push = (companyId: string, move: BoardMove) => {
    const list = byCompany.get(companyId);
    if (list) list.push(move);
    else byCompany.set(companyId, [move]);
  };

  // ── 商談 → 動き
  for (const d of deals) {
    // 担当者優先。未設定なら作成者で拠点に戻す
    const companyId =
      (d.assignedToId ? companyOfUser.get(d.assignedToId) : null) ??
      (d.createdById ? companyOfUser.get(d.createdById) : null);
    if (!companyId) continue; // 本部の商談・拠点に紐づかない商談は出さない

    const stage = stageFromDealStatus(d.status);
    if (!stage) continue;

    push(companyId, {
      id: `deal:${d.id}`,
      source: "DEAL",
      industry: normalizeIndustry(d.customer.industry),
      method: null,
      stage,
      note: null,
      movedAt: d.updatedAt,
      editable: false, // 商談の状態は商談画面で動かす（二重管理にしない）
    });
  }

  // ── 手で足した動き
  for (const m of manualMoves) {
    push(m.groupCompanyId, {
      id: m.id,
      source: "MANUAL",
      industry: normalizeIndustry(m.industry),
      method: m.method,
      stage: m.stage,
      note: m.note,
      movedAt: m.movedAt,
      editable: m.groupCompanyId === opts.myCompanyId,
    });
  }

  // ── 業界の集計は絞り込み前の全件で出す（絞ると選択肢が消えてしまうため）
  const industryCount = new Map<string, number>();
  for (const list of byCompany.values()) {
    for (const mv of list) {
      industryCount.set(mv.industry, (industryCount.get(mv.industry) ?? 0) + 1);
    }
  }

  const cards: BoardCard[] = [];
  const quietCompanies: Board["quietCompanies"] = [];

  for (const c of companies) {
    const all = byCompany.get(c.id) ?? [];
    const isMine = c.id === opts.myCompanyId;

    // 件数バッジは絞り込みに関わらず「その拠点の今月の動き」を出す
    const monthMoves = all.filter((m) => m.movedAt >= mStart && m.stage !== "LOST");
    const wonCount = monthMoves.filter((m) => m.stage === "WON").length;

    const shown = all
      .filter((m) => (opts.industry ? m.industry === opts.industry : true))
      .filter((m) => (opts.stage ? m.stage === opts.stage : true))
      .sort((a, b) => b.movedAt.getTime() - a.movedAt.getTime());

    if (all.length === 0) {
      quietCompanies.push({ companyId: c.id, companyName: c.name, isMine });
      continue;
    }
    if (shown.length === 0) continue; // 絞り込みで消えただけの拠点は静かな拠点に混ぜない

    cards.push({
      companyId: c.id,
      companyName: c.name,
      prefecture: c.prefecture,
      emoji: c.emoji,
      moves: shown,
      monthCount: monthMoves.length,
      wonCount,
      lastMovedAt: all.reduce<Date | null>(
        (acc, m) => (!acc || m.movedAt > acc ? m.movedAt : acc),
        null,
      ),
      isMine,
    });
  }

  // 動いている人が上。同数なら直近に動かした方が上
  cards.sort(
    (a, b) =>
      b.monthCount - a.monthCount ||
      (b.lastMovedAt?.getTime() ?? 0) - (a.lastMovedAt?.getTime() ?? 0) ||
      a.companyName.localeCompare(b.companyName, "ja"),
  );

  const now = new Date();
  return {
    cards,
    quietCompanies,
    totalMoves: cards.reduce((s, c) => s + c.monthCount, 0),
    totalWon: cards.reduce((s, c) => s + c.wonCount, 0),
    activeCompanies: cards.filter((c) => c.monthCount > 0).length,
    industries: [...industryCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja")),
    monthLabel: `${now.getFullYear()}年${now.getMonth() + 1}月`,
  };
}
