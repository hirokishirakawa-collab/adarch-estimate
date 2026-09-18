// ==============================================================
// Meta広告（Facebook/Instagram）— 地域限定の少額キャンペーンをAIから作る（2026-09-09 代表指示）
//   例: 「唐津市に日額500円で、TVerエリア限定プランのLPへ誘導する広告」
//   ・市の中心座標（Google Geocoding）＋半径で地域限定
//   ・キャンペーン → 広告セット → 画像 → クリエイティブ → 広告 の順に Marketing API を叩く
//   ・作成時は PAUSED（配信は人が Ads Manager で ON にするか、activate: true を明示）
//   ・接続は拠点ごと（meta_ad_accounts・/dashboard/meta-ads）。未接続なら dryRun＝送るはずの内容だけ返す。環境変数は本部の予備
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

/** 市区町村の中心座標（Google Geocoding）。キーが無ければ null
 *  キーごとにGoogle Cloudのプロジェクトが違い、Geocoding APIが有効なのは片方だけのことがある
 *  （2026-09-18: GOOGLE_API_KEY は REQUEST_DENIED・GOOGLE_PLACES_API_KEY は OK）→ 取れるまで順に試す */
export async function geocodeCity(prefecture: string, cityName: string): Promise<GeoPoint | null> {
  const keys = [process.env.GOOGLE_API_KEY, process.env.GOOGLE_PLACES_API_KEY].filter((k): k is string => !!k);
  const q = encodeURIComponent(`${prefecture}${cityName}`);
  for (const key of keys) {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&region=jp&language=ja&key=${key}`, { cache: "no-store" });
    if (!res.ok) continue;
    const j = (await res.json()) as { status?: string; results?: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[] };
    const r = j.results?.[0];
    if (r) return { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng, formatted: r.formatted_address };
  }
  return null;
}

async function graph<T>(cfg: MetaConfig, path: string, body: Record<string, unknown>): Promise<T> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) form.set(k, typeof v === "string" ? v : JSON.stringify(v));
  // トークンはURL・本文に載せず Authorization ヘッダーで
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body: form, headers: { Authorization: `Bearer ${cfg.accessToken}` } });
  const j = (await res.json()) as T & { error?: { message: string; code?: number; error_subcode?: number; error_user_title?: string; error_user_msg?: string } };
  if (!res.ok || j.error) {
    const e = j.error;
    // 「Invalid parameter」だけでは原因が分からない（2026-09-18）→ Metaの詳しい説明まで残す
    const detail = [e?.error_user_title, e?.error_user_msg, e?.error_subcode ? `subcode ${e.error_subcode}` : ""].filter(Boolean).join(" / ");
    throw new Error(`Meta API ${path}: ${e?.message ?? res.status}${detail ? `（${detail}）` : ""}`);
  }
  return j;
}

/** 送るはずの内容（ドライランでも実出稿でも同じ組み立て） */
export function buildPayloads(input: LocalCampaignInput, geo: GeoPoint | null, cfg: Pick<MetaConfig, "pageId"> | null) {
  const start = new Date();
  const end = new Date(start.getTime() + Math.max(1, Math.min(90, input.days)) * 86_400_000);
  const budget = Math.max(100, Math.round(input.dailyBudgetJpy)); // JPYは最小単位が1円
  const radius = Math.max(1, Math.min(80, input.radiusKm ?? 10));
  return {
    // 予算は広告セットごと＝広告セット間の予算共有はしない（Metaが明示を必須化）
    campaign: { name: input.name, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: [] as string[], is_adset_budget_sharing_enabled: false },
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
        // 市の位置が取れない時に全国へ広げない（2026-09-18 全国配信になりかけた）。作成側で止める
        geo_locations: geo
          ? { custom_locations: [{ latitude: geo.latitude, longitude: geo.longitude, radius, distance_unit: "kilometer" }] }
          : "<市の位置を取得できませんでした＝作成しません>",
        age_min: input.ageMin ?? 25,
        age_max: input.ageMax ?? 65,
        publisher_platforms: ["facebook", "instagram"],
        // 市の半径・年齢をMetaに広げさせない（Advantage+オーディエンスの指定をMetaが必須化）
        targeting_automation: { advantage_audience: 0 },
      },
    },
    creative: {
      name: `${input.name} / creative`,
      object_story_spec: {
        page_id: cfg?.pageId ?? "<META_PAGE_ID>",
        link_data: { link: input.landingUrl, message: input.primaryText, name: input.headline, call_to_action: { type: "LEARN_MORE", value: { link: input.landingUrl } }, picture: input.bannerUrl },
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

/** account を渡さない時は環境変数（本部の予備）。通常は拠点ごとの接続（resolveMetaConfig）を渡す */
export async function createLocalCampaign(input: LocalCampaignInput, account?: MetaConfig | null): Promise<LocalCampaignResult> {
  const cfg = account ?? metaConfig();
  const geo = await geocodeCity(input.prefecture, input.cityName).catch(() => null);
  const payloads = buildPayloads(input, geo, cfg);
  const noGeo = `${input.prefecture}${input.cityName}の位置を取得できないため、広告は作成しません（全国配信を防ぐため）。本部にお知らせください`;
  if (!cfg) {
    return { dryRun: true, status: "DRY_RUN", payloads, note: geo ? "貴社のMeta広告アカウントがOSに未接続のため、送る内容の組み立てだけ行いました。OSの「Meta広告（地域限定）」画面で広告アカウントID・ページID・アクセストークンを貼ると、この内容でそのまま作成できます（費用・運用は貴社のアカウント）" : `送る内容の組み立てだけ行いました。ただし${noGeo}` };
  }
  if (!geo) throw new Error(noGeo);
  if (!/\.(png|jpe?g)(\?|$)/i.test(input.bannerUrl)) {
    throw new Error("bannerUrl は PNG か JPG にしてください（Metaの画像要件）。/api/banner/tver?format=png を使うか、画像URLを渡してください");
  }
  const camp = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/campaigns`, payloads.campaign);
  // 途中で失敗したら作りかけのキャンペーンを消す（2026-09-18 広告セットだけ残った）
  let adset: { id: string }, ad: { id: string };
  try {
    adset = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/adsets`, { ...payloads.adset, campaign_id: camp.id });
    // 画像は adimages でアップロードせず URL（picture）で渡す＝アプリの権限段階で adimages が断られるため
    const creative = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/adcreatives`, payloads.creative);
    ad = await graph<{ id: string }>(cfg, `${cfg.adAccountId}/ads`, { ...payloads.ad, adset_id: adset.id, creative: { creative_id: creative.id } });
  } catch (err) {
    await graph(cfg, camp.id, { status: "DELETED" }).catch(() => {});
    throw err;
  }
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
