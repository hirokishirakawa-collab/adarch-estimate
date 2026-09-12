// ==============================================================
// AI連携から「新規リードを探す」＝リード獲得AI（Google Places → 採点 → 保存）を1コールで（2026-09-09 代表指示）
//   OS画面のリード獲得AIと同じ部品（searchPlaces / runLeadScoring）と同じ保存の決まり
//   （同名＋同住所は1件・既存は採点だけ更新・取得の蓋・担当は本人・シグナル=発掘日）。
//   金額は扱わない。呼んだ人の権限で動く（セッションではなく McpViewer）。
// ==============================================================

import { db } from "@/lib/db";
import { searchPlaces } from "./places-search";
import { runLeadScoring } from "./score-pipeline";
import { checkSaveCap } from "./release-stale";
import { resolveSignal, shouldReplaceSignal } from "./signal";
import { buildPlaceLeadMemo } from "./company-memo";
import { logApiUsage } from "@/lib/api-usage";
import { enrichLeads, type EnrichResult } from "./enrich";
import type { ScoredLead } from "@/lib/constants/leads";

export interface DiscoverInput {
  prefecture: string;
  city?: string;
  industry: string;
  keywords?: string;
  count?: number;
  /** true なら採点だけして保存しない（見てから決める） */
  dryRun?: boolean;
  /** チェーン・FC・支店を保存しない（既定 true）。本部決裁で商圏の話が通らないため */
  excludeChains?: boolean;
  /** 保存後にサイトを見てメール補完＋営業お断り判定をしない（既定 false＝する） */
  skipEnrich?: boolean;
}

/** 本部決裁＝市の商圏で話が通らない相手。発掘の段階で外す */
const CHAIN_TYPES = new Set(["chain", "franchise", "branch"]);

export interface DiscoverViewer {
  id: string;
  email: string;
  name: string | null;
  branchId: string | null;
  branchId2?: string | null;
}

export async function discoverLeads(v: DiscoverViewer, input: DiscoverInput) {
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!placesKey || !anthropicKey) throw new Error("リード獲得AIの設定（Places／Anthropic のキー）が未設定です。本部にお知らせください");
  const count = Math.min(20, Math.max(1, Math.floor(input.count ?? 10)));
  const area = [input.prefecture, input.city].filter(Boolean).join("");

  // 取得の蓋（送ってから取る運用）は保存前に見る
  const cap = await checkSaveCap(v.id);
  if (cap.blocked && !input.dryRun) return { blocked: true, reason: cap.message ?? "未送付のリードが多いため、新規の保存は止まっています", unsent: cap.unsent };

  logApiUsage(v.email, "leads/search");
  const places = await searchPlaces({ prefecture: input.prefecture, city: input.city ?? "", industry: input.industry, industryKeywords: input.keywords ?? "", count }, placesKey);
  if (places.length === 0) return { found: 0, saved: 0, leads: [], note: "該当する企業が見つかりませんでした。業種の言い方（例: 歯科→歯科医院）や市を変えてみてください" };

  logApiUsage(v.email, "leads/score");
  const branchIds = [v.branchId, v.branchId2 ?? null].filter((b): b is string => !!b);
  const scored = await runLeadScoring({ places, industry: input.industry, area }, branchIds, anthropicKey);
  const scoreByName = new Map(scored.scores.map((s) => [s.name, s]));
  const leads: ScoredLead[] = places
    .map((p) => {
      const s = scoreByName.get(p.name);
      return { ...p, score: s ? { total: s.total, breakdown: s.breakdown, comment: s.comment } : { total: 0, breakdown: {}, comment: "" }, digitalAnalysis: scored.analyses[p.name] } as ScoredLead;
    })
    .sort((a, b) => b.score.total - a.score.total);

  let saved = 0;
  let updated = 0;
  const staffName = v.name ?? v.email;
  const ids = new Map<string, string>();
  const excludeChains = input.excludeChains !== false;
  const excluded: { name: string; reason: string }[] = [];
  if (!input.dryRun) {
    for (const lead of leads) {
      // チェーン・FC・支店は保存しない（判定は採点時のサイト分析が既に出している）
      const bt = lead.digitalAnalysis?.businessType;
      if (excludeChains && bt && CHAIN_TYPES.has(bt)) {
        excluded.push({ name: lead.name, reason: lead.digitalAnalysis?.businessTypeReason || "チェーン・FC・支店" });
        continue;
      }
      const existing = await db.lead.findUnique({ where: { name_address: { name: lead.name, address: lead.address ?? "" } } });
      const companyMemo = buildPlaceLeadMemo(lead);
      const signal = resolveSignal("FOUND", null);
      if (existing) {
        await db.lead.update({
          where: { id: existing.id },
          data: {
            scoreTotal: lead.score.total, scoreBreakdown: lead.score.breakdown as Record<string, number>, scoreComment: lead.score.comment,
            rating: lead.rating, ratingCount: lead.ratingCount, businessStatus: lead.businessStatus,
            ...(existing.memo || !companyMemo ? {} : { memo: companyMemo }),
            ...(existing.assigneeId ? {} : { assigneeId: v.id }),
            ...(shouldReplaceSignal(existing, signal) ? signal : {}),
          },
        });
        ids.set(lead.name, existing.id);
        updated++;
      } else {
        const created = await db.lead.create({
          data: {
            name: lead.name, address: lead.address || null, phone: lead.phone || null, rating: lead.rating, ratingCount: lead.ratingCount, types: lead.types,
            mapsUrl: lead.mapsUrl || null, websiteUrl: lead.websiteUrl || null, businessStatus: lead.businessStatus || null,
            scoreTotal: lead.score.total, scoreBreakdown: lead.score.breakdown as Record<string, number>, scoreComment: lead.score.comment,
            memo: companyMemo || null, ...signal, industry: input.industry, area, createdById: v.id, assigneeId: v.id,
          },
        });
        await db.leadLog.create({ data: { leadId: created.id, action: "CREATED", detail: `[AI記録] AI連携のリード獲得AIから保存（スコア: ${lead.score.total}）`, staffName } });
        ids.set(lead.name, created.id);
        saved++;
      }
    }
  }

  // 保存した先のサイトを1回だけ見て、メールを埋め、営業お断りを外す（＝送る前の掃除）。
  // お断りはグループ共通リストに入るので、以後どの拠点からも送られない。
  let cleanup: EnrichResult | null = null;
  if (!input.dryRun && !input.skipEnrich && ids.size > 0) {
    try {
      cleanup = await enrichLeads([...ids.values()], { staffName });
    } catch (e) {
      console.error("discoverLeads: enrich failed", e);
    }
  }

  return {
    target: { prefecture: input.prefecture, city: input.city ?? null, industry: input.industry, keywords: input.keywords ?? null },
    found: places.length,
    saved,
    updated,
    excludedChains: excluded.length ? { count: excluded.length, note: "チェーン・FC・支店は本部決裁のため保存していません", companies: excluded.slice(0, 20) } : null,
    cleanup: cleanup
      ? {
          checked: cleanup.checked,
          emailFound: cleanup.found,
          noSolicitation: cleanup.blocked,
          noSolicitationCompanies: cleanup.blockedNames,
          note: "サイトを見てメールを補完し、営業お断りの会社は対象外にして全社の送付禁止リストに登録しました",
        }
      : null,
    dryRun: !!input.dryRun,
    scoringBasis: scored.scoringBasis ? { day: scored.scoringBasis.day, delta: scored.scoringBasis.delta, reasons: scored.scoringBasis.reasons } : null,
    leads: leads.map((l) => ({
      leadId: ids.get(l.name) ?? null, name: l.name, address: l.address, phone: l.phone || null, website: l.websiteUrl || null,
      rating: l.rating, ratingCount: l.ratingCount, score: l.score.total, comment: l.score.comment,
      hasEmailCheck: null as null, isFutureOpening: l.isFutureOpening ?? false,
    })),
    next: input.dryRun
      ? "保存するなら dryRun を外してもう一度。保存後は plan_campaign で当たりやすい順に並べ、prepare_outreach で文面を下書きにする"
      : "保存しました（担当は本人）。メールの補完と営業お断りの判定はこの場で済んでいます（cleanup）。続けて plan_campaign(prefecture, city, industry) で並べ替え、prepare_outreach(leadId, subject, body) で下書きに",
  };
}
