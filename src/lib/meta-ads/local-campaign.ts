// ==============================================================
// Meta広告（Facebook/Instagram）— 地域限定の少額キャンペーンをAIから作る（2026-09-09 代表指示）
//   例: 「唐津市に日額500円で、TVerエリア限定プランのLPへ誘導する広告」
//   ・市の中心座標（Google Geocoding）＋半径で地域限定
//   ・キャンペーン → 広告セット → 画像 → クリエイティブ → 広告 の順に Marketing API を叩く
//   ・作成時は PAUSED（配信は人が Ads Manager で ON にするか、activate: true を明示）
//   ・META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / META_PAGE_ID が無ければ dryRun＝送るはずの内容だけ返す
//   ・バナーは /api/banner/tver（OSの数字から型で描く）。Metaは PNG/JPG を要求するため、
//     実出稿時は bannerUrl に PNG を渡す（SVG は下書き確認用）
// ==============================================================

const API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export interface MetaConfig {
  accessToken: string;
  adAccountId: string; // act_XXXX
  pageId: string;
}

export function metaConfig(): MetaConfig | null {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const pageId = process.env.META_PAGE_ID;
  if (!accessToken || !adAccountId || !pageId) return null;
  return { accessToken, adAccountId: adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`, pageId };
}

export interface LocalCampaignInput {
  name: string;
  prefecture: string;
  cityName: string;
  radiusKm?: number;
  dailyBudgetJpy: number;
  days: number;
  landingUrl: string;
  headline: string;
  primaryText: string;
  bannerUrl: string;
  ageMin?: number;
  ageMax?: number;
  activate?: boolean;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  formatted: string;
}

/** 市区町村の中心座標（Google Geocoding）。キーが無ければ null */
export async function geocodeCity(prefecture: string, cityName: string): Promise<GeoPoint | null> {
  const key = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const q = encodeURIComponent(`${prefecture}${cityName}`);
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&region=jp&language=ja&key=${key}`, { cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as { results?: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[] };
  const r = j.results?.[0];
  return r ? { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng, formatted: r.formatted_address } : null;
}

async function graph<T>(cfg: MetaConfig, path: string, body: Record<string, unknown>): Promise<T> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) form.set(k, typeof v === "string" ? v : JSON.stringify(v));
  form.set("access_token", cfg.accessToken);
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body: form });
  const j = (await res.json()) as T & { error?: { message: string; code?: number } };
  if (!res.ok || j.error) throw new Error(`Meta API ${path}: ${j.error?.message ?? res.status}`);
  return j;
}

/** 送るはずの内容（ドライランでも実出稿でも同じ組み立て） */
export function buildPayloads(input: LocalCampaignInput, geo: GeoPoint | null, cfg: Pick<MetaConfig, "pageId"> | null) {
  const start = new Date();
  const end = new Date(start.getTime() + Math.max(1, Math.min(90, input.days)) * 86_400_000);
  const budget = Math.max(100, Math.round(input.dailyBudgetJpy)); // JPYは最小単位が1円
  const radius = Math.max(1, Math.min(80, input.radiusKm ?? 10));
  return {
    campaign: { name: input.name, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: [] as string[] },
    adset: {
      name: `${input.name} / ${input.cityName} ${radius}km`,
      daily_budget: budget,
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "PAUSED",
      targeting: {
        geo_locations: geo
          ? { custom_locations: [{ latitude: geo.latitude, longitude: geo.longitude, radius, distance_unit: "kilometer" }] }
          : { countries: ["JP"] },
        age_min: input.ageMin ?? 25,
        age_max: input.ageMax ?? 65,
        publisher_platforms: ["facebook", "instagram"],
      },
    },
    image: { url: input.bannerUrl },
    creative: {
      name: `${input.name} / creative`,
      object_story_spec: {
        page_id: cfg?.pageId ?? "<META_PAGE_ID>",
        link_data: { link: input.landingUrl, message: input.primaryText, name: input.headline, call_to_action: { type: "LEARN_MORE", value: { link: input.landingUrl } }, image_hash: "<uploaded>" },
      },
    },
    ad: { name: `${input.name} / ad`, status: input.activate ? "ACTIVE" : "PAUSED" },
    meta: { geo, budgetJpyPerDay: budget, days: Math.max(1, Math.min(90, input.days)), radiusKm: radius },
  };
}

export interface LocalCampaignResult {
  dryRun: boolean;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  adsManagerUrl?: string;
  status: "PAUSED" | "ACTIVE" | "DRY_RUN";
  payloads: ReturnType<typeof buildPayloads>;
  note: string;
}

export async function createLocalCampaign(input: LocalCampaignInput): Promise<LocalCampaignResult> {
  const cfg = metaConfig();
  const geo = await geocodeCity(input.prefecture, input.cityName).catch(() => null);
  const payloads = buildPayloads(input, geo, cfg);
  if (!cfg) {
    return { dryRun: true, status: "DRY_RUN", payloads, note: "MetaのAPIキー（META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / META_PAGE_ID）が未設定のため、送る内容の組み立てだけ行いました。本部でMeta広告アカウントを接続すると、この内容でそのまま作成できます" };
  }
  if (!/\.(png|jpe?g)(\?|$)/i.test(input.bannerUrl)) {
    throw new Error("bannerUrl は PNG か JPG にしてください（Metaの画像要件）。/api/banner/tver?format=png を使うか、画像URLを渡してください");
  }
  const camp = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/campaigns`, payloads.campaign);
  const adset = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/adsets`, { ...payloads.adset, campaign_id: camp.id });
  const img = await graph<{ images: Record<string, { hash: string }> }>(cfg, `${cfg.adAccountId}/adimages`, payloads.image);
  const hash = Object.values(img.images)[0]?.hash;
  if (!hash) throw new Error("画像のアップロードに失敗しました");
  const creative = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/adcreatives`, {
    name: payloads.creative.name,
    object_story_spec: { ...payloads.creative.object_story_spec, link_data: { ...payloads.creative.object_story_spec.link_data, image_hash: hash } },
  });
  const ad = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/ads`, { ...payloads.ad, adset_id: adset.id, creative: { creative_id: creative.id } });
  if (input.activate) {
    await graph(cfg, `${camp.id}`, { status: "ACTIVE" });
    await graph(cfg, `${adset.id}`, { status: "ACTIVE" });
  }
  return {
    dryRun: false,
    campaignId: camp.id,
    adsetId: adset.id,
    adId: ad.id,
    adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cfg.adAccountId.replace(/^act_/, "")}&selected_campaign_ids=${camp.id}`,
    status: input.activate ? "ACTIVE" : "PAUSED",
    payloads,
    note: input.activate ? "配信中です。停止は Ads Manager か update で" : "PAUSED で作成しました。Ads Manager で内容を確認して配信をONにしてください（activate: true で最初からON）",
  };
}
