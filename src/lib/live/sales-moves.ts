// ==============================================================
// グループライブ — TVer・営業の武器・お客様からの相談を ACTIVITY FEED に流す（2026-09-15 代表選択）
//   tver  : 業態考査の申請／OK、配信の申請、配信スタート
//   tool  : 郵送DMの用意・発送、営業LPの作成、Web提案書の作成、パッケージの販売開始
//   visit : TVer申込ページからの相談・申込（お客様の名前は出さない）
//   ad    : 地域限定Meta広告の配信スタート（初めて ACTIVE になった時刻＝2026-09-18 代表指示。停止中の記録は流さない）
//   ⚠️ 金額は取得しない。DM・LP・提案書・相談は相手先名も出さない（市・業種まで）。
//      業態考査・配信は商談と同じく広告主名を出す（ライブは社名を出す面＝2026-08-24 代表決定）
// ==============================================================

import { db } from "@/lib/db";

export type SalesMoveKind = "tver" | "tool" | "visit" | "ad";
export interface SalesMoveEvent {
  at: string;
  kind: SalesMoveKind;
  actor: string;
  prefs: string[];
  text: string;
}

const PREFS = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];
const prefsIn = (...texts: (string | null | undefined)[]) =>
  [...new Set(texts.flatMap((t) => (t ? PREFS.filter((p) => t.includes(p)) : [])))];

export async function buildSalesMoveEvents(since: Date): Promise<SalesMoveEvent[]> {
  const now = new Date();
  const [reviews, campaigns, orders, dmKits, lps, proposals, packages, ads] = await Promise.all([
    db.advertiserReview.findMany({
      where: { OR: [{ createdAt: { gte: since } }, { reviewedAt: { gte: since }, status: "APPROVED" }] },
      select: { createdAt: true, reviewedAt: true, status: true, name: true, branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.tverCampaign.findMany({
      where: {
        status: { not: "DRAFT" },
        OR: [{ createdAt: { gte: since } }, { startDate: { gte: since, lte: now }, status: "APPROVED" }],
      },
      select: { createdAt: true, startDate: true, endDate: true, status: true, advertiser: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    // 取り下げ・返金と、社内アドレスからの申込（本部の動作確認）は流さない
    db.tverOrder.findMany({
      where: {
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        NOT: { email: { endsWith: "@adarch.co.jp" } },
        OR: [{ createdAt: { gte: since } }, { liveStartDate: { gte: since, lte: now } }],
      },
      select: { createdAt: true, liveStartDate: true, areaLabel: true, prefName: true, consultMethod: true, groupCompany: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.dmKit.findMany({
      where: { OR: [{ createdAt: { gte: since } }, { sentAt: { gte: since } }] },
      select: { createdAt: true, sentAt: true, prefecture: true, city: true, industry: true, readyCount: true, branchId: true, groupCompanyId: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.landingPage.findMany({
      where: { createdAt: { gte: since }, status: { not: "ARCHIVED" } },
      select: { createdAt: true, prefecture: true, cityName: true, industry: true, branchId: true, groupCompanyId: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.proposal.findMany({
      where: { createdAt: { gte: since }, user: { email: { notIn: ["demo@adarch.co.jp", "arch-kun@adarch.co.jp"] } } },
      select: { createdAt: true, industry: true, user: { select: { role: true, branch: { select: { name: true } }, groupCompany: { select: { name: true, prefecture: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.salesPackage.findMany({
      where: { status: "ACTIVE", approvedAt: { gte: since } },
      select: { approvedAt: true, name: true },
      orderBy: { approvedAt: "desc" },
      take: 20,
    }),
    // 金額（日額・消化）は取らない。市・業種まで
    db.metaAdRecord.findMany({
      where: { activatedAt: { gte: since } },
      select: { activatedAt: true, prefecture: true, cityName: true, industry: true, branchId: true, groupCompanyId: true },
      orderBy: { activatedAt: "desc" },
      take: 40,
    }),
  ]);

  // DM・LPは拠点／加盟会社をIDだけで持っている＝名前を後から引く
  const branchIds = [...new Set([...dmKits, ...lps, ...ads].map((r) => r.branchId).filter((x): x is string => !!x))];
  const companyIds = [...new Set([...dmKits, ...lps, ...ads].map((r) => r.groupCompanyId).filter((x): x is string => !!x))];
  const [branches, companies] = await Promise.all([
    branchIds.length ? db.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } }) : [],
    companyIds.length ? db.groupCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : [],
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const actorOf = (r: { branchId: string | null; groupCompanyId: string | null }) =>
    (r.branchId && branchName.get(r.branchId)) || (r.groupCompanyId && companyName.get(r.groupCompanyId)) || "本部";

  const events: SalesMoveEvent[] = [];
  const push = (at: Date, kind: SalesMoveKind, actor: string, prefs: string[], text: string) => {
    if (at < since || at > now) return;
    events.push({ at: at.toISOString(), kind, actor, prefs, text });
  };

  // ---- TVer ----
  for (const r of reviews) {
    const actor = r.branch.name;
    push(r.createdAt, "tver", actor, prefsIn(actor), `「${r.name}」のTVer業態考査を申請`);
    if (r.status === "APPROVED" && r.reviewedAt) {
      push(r.reviewedAt, "tver", actor, prefsIn(actor), `「${r.name}」のTVer業態考査がOK`);
    }
  }
  for (const c of campaigns) {
    const actor = c.branch.name;
    const days = Math.max(1, Math.round((c.endDate.getTime() - c.startDate.getTime()) / 86_400_000) + 1);
    push(c.createdAt, "tver", actor, prefsIn(actor), `「${c.advertiser.name}」のTVer配信を申請（${days}日間）`);
    if (c.status === "APPROVED") {
      push(c.startDate, "tver", actor, prefsIn(actor), `「${c.advertiser.name}」のTVer配信がスタート`);
    }
  }
  for (const o of orders) {
    // 本部の加盟会社行（「白川 裕喜（本部）」）は他の行と同じ「本部」にそろえる
    const actor = !o.groupCompany || o.groupCompany.name.includes("（本部）") ? "本部" : o.groupCompany.name;
    const prefs = prefsIn(o.prefName);
    push(o.createdAt, "visit", actor, prefs, `${o.areaLabel}のTVerエリア限定プランに、お客様から${o.consultMethod ? "相談" : "申込"}が入りました`);
    if (o.liveStartDate) push(o.liveStartDate, "tver", actor, prefs, `${o.areaLabel}でTVer配信がスタート`);
  }

  // ---- 地域限定Meta広告 ----
  for (const a of ads) {
    if (!a.activatedAt) continue;
    push(a.activatedAt, "ad", actorOf(a), prefsIn(a.prefecture), `${a.prefecture}${a.cityName}で${a.industry ? `${a.industry}の` : ""}地域限定広告の配信がスタート`);
  }

  // ---- 営業の武器 ----
  for (const k of dmKits) {
    const actor = actorOf(k);
    const prefs = prefsIn(k.prefecture);
    const target = `${k.city}の${k.industry ?? "企業"}`;
    push(k.createdAt, "tool", actor, prefs, `${target}${k.readyCount > 0 ? `${k.readyCount}社` : ""}へ郵送DMを用意`);
    if (k.sentAt) push(k.sentAt, "tool", actor, prefs, `${target}${k.readyCount > 0 ? `${k.readyCount}社` : ""}へ郵送DMを発送`);
  }
  for (const p of lps) {
    const label = [p.cityName, p.industry].filter(Boolean).join("×");
    push(p.createdAt, "tool", actorOf(p), prefsIn(p.prefecture), `${label ? `${label}の` : ""}営業LPを作成`);
  }
  for (const p of proposals) {
    const u = p.user;
    if (u.role !== "ADMIN" && !u.branch && !u.groupCompany) continue; // 拠点未割当は流さない
    const actor = u.role === "ADMIN" ? "本部" : (u.branch?.name ?? u.groupCompany?.name ?? "本部");
    push(p.createdAt, "tool", actor, prefsIn(u.branch?.name, u.groupCompany?.prefecture), `${p.industry ? `${p.industry}向けの` : ""}Web提案書を作成`);
  }
  for (const s of packages) {
    if (s.approvedAt) push(s.approvedAt, "tool", "本部", [], `新しいパッケージ「${s.name}」の販売がスタート`);
  }

  return events;
}
