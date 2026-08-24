import Link from "next/link";
import { Waypoints } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMoveBoard, WINDOW_DAYS, type BoardMove } from "@/lib/group-moves/board";
import {
  STAGE_OPTIONS,
  getStage,
  getMethodLabel,
  fmtAgo,
  daysSince,
  STALE_DAYS,
} from "@/lib/constants/group-move";
import { AddMoveForm } from "@/components/group-moves/add-move-form";
import { MoveStageBar } from "@/components/group-moves/move-stage-bar";
import { WikiHelpLink } from "@/components/wiki/wiki-help-link";
import { cn } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ industry?: string; stage?: string }>;
}

/** 1枚のカードに出す動きの数。多い拠点で縦に伸びすぎるのを防ぐ */
const SHOWN_PER_CARD = 6;

export default async function GroupMovesPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;

  const me = session?.user?.email
    ? await db.user.findUnique({
        where: { email: session.user.email },
        select: { groupCompanyId: true },
      })
    : null;

  const board = await getMoveBoard({
    myCompanyId: me?.groupCompanyId ?? null,
    industry: params.industry,
    stage: params.stage,
  });

  // 選択中のチップをもう一度押したら外れる（絞ったまま戻れなくなるのを防ぐ）
  const qs = (next: { industry?: string; stage?: string }) => {
    const merged = { ...params };
    if (next.industry !== undefined) {
      merged.industry = params.industry === next.industry ? undefined : next.industry;
    }
    if (next.stage !== undefined) {
      merged.stage = params.stage === next.stage ? undefined : next.stage;
    }
    const sp = new URLSearchParams();
    if (merged.industry) sp.set("industry", merged.industry);
    if (merged.stage) sp.set("stage", merged.stage);
    const s = sp.toString();
    return s ? `?${s}` : "/dashboard/group-moves";
  };

  const chip = (active: boolean) =>
    cn(
      "text-[11px] px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap",
      active
        ? "bg-zinc-800 text-white border-zinc-800"
        : "text-zinc-500 border-zinc-200 hover:border-zinc-400",
    );

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full space-y-5">
      {/* ヘッダー */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
            <Waypoints className="text-teal-700" style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">グループの動き</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              誰が今どの業界に、どう当たって、どこまで進んでいるか。金額と会社名は出ません
            </p>
            <WikiHelpLink query="グループの動き" />
          </div>
        </div>
        {/* 加盟会社に紐づかないアカウント（本部）には出さない＝押してから断るのを避ける */}
        {me?.groupCompanyId && <AddMoveForm />}
      </div>

      {/* 集計 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: `${board.monthLabel}の動き`, value: board.totalMoves, cls: "text-teal-700" },
          { label: "動いている拠点", value: `${board.activeCompanies}社`, cls: "text-zinc-800" },
          { label: `${board.monthLabel}の受注`, value: board.totalWon, cls: "text-emerald-700" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-zinc-200 px-3 py-2.5">
            <p className="text-[10px] text-zinc-400">{s.label}</p>
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 絞り込み */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-zinc-400 w-8">業界</span>
          <Link href="/dashboard/group-moves" className={chip(!params.industry && !params.stage)}>
            すべて
          </Link>
          {board.industries.map((i) => (
            <Link key={i.name} href={qs({ industry: i.name })} className={chip(params.industry === i.name)}>
              {i.name} {i.count}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-zinc-400 w-8">段階</span>
          {STAGE_OPTIONS.map((s) => (
            <Link key={s.value} href={qs({ stage: s.value })} className={chip(params.stage === s.value)}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 拠点カード */}
      {board.cards.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 py-12 text-center">
          <p className="text-sm text-zinc-400">この条件の動きはまだありません</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {board.cards.map((card) => (
            <div
              key={card.companyId}
              className={cn(
                "bg-white rounded-xl border p-4",
                card.isMine ? "border-teal-300 ring-1 ring-teal-100" : "border-zinc-200",
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-zinc-900 truncate">
                    {card.emoji ? `${card.emoji} ` : ""}{card.companyName}
                  </span>
                  {card.isMine && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                      自分
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-zinc-400">今月</span>
                  <span className="text-base font-bold text-zinc-800 tabular-nums">{card.monthCount}</span>
                  {card.wonCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      受注 {card.wonCount}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-2">
                {card.moves.slice(0, SHOWN_PER_CARD).map((m) => (
                  <MoveRow key={m.id} move={m} />
                ))}
              </ul>
              {card.moves.length > SHOWN_PER_CARD && (
                <p className="text-[10px] text-zinc-400 mt-2">
                  ほか {card.moves.length - SHOWN_PER_CARD} 件（業界か段階で絞ると出ます）
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 動きが出ていない拠点 */}
      {board.quietCompanies.length > 0 && (
        <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-4 py-3">
          <p className="text-[11px] text-zinc-400 mb-1.5">
            直近{WINDOW_DAYS}日で動きが出ていない拠点（商談を入れていないだけの場合もあります）
          </p>
          <div className="flex flex-wrap gap-1.5">
            {board.quietCompanies.map((c) => (
              <span
                key={c.companyId}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border",
                  c.isMine
                    ? "bg-white text-teal-700 border-teal-300"
                    : "bg-white text-zinc-400 border-zinc-200",
                )}
              >
                {c.companyName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 動き1行。商談から来たものは商談画面で動かすので段階ボタンを出さない。
// ---------------------------------------------------------------
function MoveRow({ move }: { move: BoardMove }) {
  const stage = getStage(move.stage);
  const stale = daysSince(move.movedAt) >= STALE_DAYS;

  return (
    <li className={cn("border-t border-zinc-100 pt-2 first:border-0 first:pt-0", stale && "opacity-50")}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-zinc-800">{move.industry}</span>
        <span className="text-[11px] text-zinc-400">
          {move.method ? getMethodLabel(move.method) : "商談"}
        </span>
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", stage.className)}>
          {stage.label}
        </span>
        <span className="text-[10px] text-zinc-400 ml-auto">{fmtAgo(move.movedAt)}</span>
      </div>
      {move.note && <p className="text-[11px] text-zinc-600 mt-1">{move.note}</p>}
      {move.editable && <MoveStageBar moveId={move.id} stage={move.stage} />}
    </li>
  );
}
