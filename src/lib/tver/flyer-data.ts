// 本部チラシ制作サポート — DBレコード → チラシ描画用データの組み立て（サーバー専用・純粋）
import { planForCodes, neighborPlans, coverageAt, type AdSeconds } from "@/lib/tver/plan";
import { heroDataUrl } from "@/lib/tver/hero-image";

/** DBの TverFlyerRequest から必要な列だけ */
export interface FlyerSource {
  municipalityCodes: string[];
  adSeconds: number;
  budget: number | null;
  clientName: string | null;
  industry: string | null;
  monthlyOverride: number | null;
  totalOverride: number | null;
  catchCopy: string | null;
  issuerName: string | null;
  issuerContact: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
  heroImage?: Uint8Array | Buffer | null;
  heroImageType?: string | null;
}

export interface FlyerData {
  areaLabel: string;
  prefName: string;
  municipalityNames: string[];
  population: number;
  viewers: number;
  reach: number;
  seconds: AdSeconds;
  monthly: number; // 表示する月額（手直し反映後）
  total: number; // 表示する3ヶ月総額（手直し反映後）
  calcMonthly: number; // 計算値
  calcTotal: number; // 計算値
  coverage: { budget: number; reach: number; pct: number; isCustom: boolean };
  neighbors: { areaLabel: string; population: number; viewers: number; monthly: number }[];
  clientName: string | null;
  industry: string | null;
  catchCopy: string | null;
  issuerName: string;
  issuerContact: string | null;
  date: Date;
  heroDataUrl: string | null; // 上部ビジュアル（data URL）。null=従来のSVGイラスト
}

function toSeconds(n: number): AdSeconds {
  return n === 30 || n === 60 ? n : 15;
}

export function buildFlyerData(src: FlyerSource): FlyerData | null {
  const seconds = toSeconds(src.adSeconds);
  const plan = planForCodes(src.municipalityCodes, seconds);
  if (!plan) return null;

  const budget = src.budget && src.budget > 0 ? src.budget : 1_000_000;
  const cov = coverageAt(plan, budget);
  const neighbors = neighborPlans(plan, 3, seconds).map((p) => ({
    areaLabel: p.areaLabel,
    population: p.population,
    viewers: p.viewers,
    monthly: p.monthly,
  }));

  return {
    areaLabel: plan.areaLabel,
    prefName: plan.prefName,
    municipalityNames: plan.municipalities.map((m) => m.name),
    population: plan.population,
    viewers: plan.viewers,
    reach: plan.reach,
    seconds,
    monthly: src.monthlyOverride ?? plan.monthly,
    total: src.totalOverride ?? plan.total,
    calcMonthly: plan.monthly,
    calcTotal: plan.total,
    coverage: { budget, reach: cov.reach, pct: cov.pct, isCustom: !!(src.budget && src.budget > 0) },
    neighbors,
    clientName: src.clientName,
    industry: src.industry,
    catchCopy: src.catchCopy,
    issuerName: src.issuerName?.trim() || "Ad Archグループ",
    issuerContact: src.issuerContact,
    date: src.deliveredAt ?? src.createdAt,
    heroDataUrl: heroDataUrl(src.heroImage, src.heroImageType),
  };
}
