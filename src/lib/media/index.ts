// ==============================================================
// 媒体メニュー — ブランドキット用の「媒体の事実」を組み立てる
//   価格の正本は各 src/lib/media/<id>.ts（シミュレーターと共通）。
//   ここでは「お客様に出してよい数字」だけを組む＝販売価格（税抜）のみ。
//   仕入れ・倍率・粗利は決して書かない（この設計自体が線引き）。
// ==============================================================

import { AREAS, TARGETING } from "./taxi";
import { REGULAR_MENU, GOLF_COURSES } from "./golfcart";
import { PERIODS, INFO_PERIODS_JP, INFO_PERIODS_IB, JP_PRICES, IB_PRICES, INFO_JP, INFO_IB, MIRRORING_MONTHLY, VOD_PRICES, AREA_META } from "./omochannel";
import { getMediaFeePerStore, STICKER_PROD_BPS, STAND_PROD_BPS, interpolateFee, DESIGN_FEE as SKYLARK_DESIGN_FEE } from "./skylark";
import { getPrintUnitPrice, PLACEMENT_UNIT, SHIPPING_UNIT, DESIGN_FEE as UNIV_DESIGN_FEE } from "./univ-coop";
import { dcpFee, deliveryFee } from "./aeon-cinema";
import { AD_FORMATS, sellCpm, calcAdArchFees, TVER_PENETRATION } from "./tver-sim";
import { AEON_THEATERS, CINEMA_AD_COLS } from "@/data/aeon-theaters";
import { SKYLARK_STORES } from "@/data/skylark-stores";
import { UNIV_STORES } from "@/data/univ-stores";

/** OSの「販売価格」＝定価（媒体社の料金表）を基にOSが出している金額。シミュレーターのPDFと同じ値 */
const sell = (listPrice: number) => Math.round(listPrice * 1.2);
const yen = (v: number) => `¥${Math.round(v).toLocaleString("ja-JP")}`;
const man = (v: number) => {
  const m = v / 10_000;
  if (m >= 10_000) return `${(m / 10_000).toFixed(1)}億円`;
  if (m >= 1) return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}万円`;
  return `${Math.round(v).toLocaleString("ja-JP")}円`;
};
const norm = (pref: string | null | undefined) => (pref ?? "").replace(/[都道府県]$/, "");
const samePref = (a: string | null | undefined, b: string) => !!a && norm(a) === norm(b);

export interface MediumDef {
  id: string;
  name: string; // メニュー名
  short: string; // 一言
  what: string; // 何か（お客様に説明する言葉）
  fits: string; // 向いている相手
  caveats: string[]; // 媒体固有の注意（言ってよい/いけない に足す）
  simulatorPath: string; // OSのシミュレーター
  facts: (viewerPref: string | null) => string; // 2. 媒体の事実（Markdown）
  talk: string[]; // 5. 切り口
}

// ---------------------------------------------------------------
export const MEDIA: MediumDef[] = [
  {
    id: "taxi",
    name: "タクシー広告（TOKYO PRIME）",
    short: "タクシー後部座席のサイネージ。ビジネス層に、乗車中に届く",
    what: "タクシー後部座席のデジタルサイネージ（TOKYO PRIME）に動画広告を流します。全国メニューとエリア指定、性別・年代などのターゲティングを組み合わせます。掲載は週単位です。",
    fits: "経営者・管理職・富裕層向けの商材（BtoB、金融、不動産、高単価サービス）、都市部の認知施策",
    caveats: ["表示回数は媒体社の想定値。「必ず何回表示」とは言わない", "エリア指定は下の表にあるエリアのみ。それ以外の県は単独では出せない（本部確認）", "掲載週数は1週から。申込から掲載までの期間は本部確認"],
    simulatorPath: "/dashboard/taxi-ads-simulator",
    talk: ["最初の質問: 「決裁者に直接届けたい商材はありますか？」", "刺さる言い方: 「乗っている間、他に見るものがない画面です」", "反論「高い」→ エリア指定（週あたりの金額）から。ターゲティングは1セグメント・4週から"],
    facts: () => {
      const national = [
        ["1st Ads", "FULL", 20_000_000, 5_600_000], ["1st Ads", "HALF", 10_000_000, 2_800_000],
        ["2nd Ads（1stとのセット）", "+FULL", 3_400_000, 5_000_000], ["2nd Ads（1stとのセット）", "+HALF", 1_700_000, 2_500_000],
        ["2nd Ads（単独）", "FULL", 12_000_000, 4_000_000], ["2nd Ads（単独）", "HALF", 6_000_000, 2_000_000],
        ["3rd Ads", "FULL", 6_600_000, 2_600_000], ["3rd Ads", "HALF", 3_300_000, 1_300_000],
        ["Boarding Ads", "FULL", 5_500_000, 5_200_000], ["Boarding Ads", "HALF", 2_750_000, 2_600_000],
        ["シートベルト着用アナウンス", "—", 2_000_000, 5_600_000],
        ["2nd Contents", "FULL", 8_000_000, 4_000_000], ["2nd Contents", "HALF", 4_000_000, 2_000_000],
        ["3rd Contents", "FULL", 3_600_000, 2_600_000], ["3rd Contents", "HALF", 1_800_000, 1_300_000],
      ] as const;
      const lines: string[] = [];
      lines.push("**全国メニュー（販売価格・税抜・1週あたり）**");
      lines.push("| 枠 | 区分 | 1週の販売価格 | 想定表示回数／週 |\n|---|---|---|---|");
      for (const [n, k, p, i] of national) lines.push(`| ${n} | ${k} | ${man(sell(p))} | ${man(i).replace("円", "回")} |`);
      lines.push("");
      lines.push("**エリア指定メニュー（販売価格・税抜・1週あたり）**");
      lines.push("| エリア | 対象 | 2nd Ads FULL | 2nd Ads HALF | 3rd Ads FULL | 3rd Ads HALF |\n|---|---|---|---|---|---|");
      for (const a of AREAS) {
        lines.push(`| ${a.label} | ${a.prefectures} | ${man(sell(a.p2nd.full))} | ${a.hasHalf ? man(sell(a.p2nd.half)) : "—"} | ${man(sell(a.p3rd.full))} | ${a.hasHalf ? man(sell(a.p3rd.half)) : "—"} |`);
      }
      lines.push("");
      lines.push("**ターゲティング（販売価格・税抜・1週あたり）**");
      lines.push("| セグメント | 分類 | 1週の販売価格 | 想定表示回数／週 |\n|---|---|---|---|");
      for (const t of TARGETING) lines.push(`| ${t.label} | ${t.category} | ${man(sell(t.pricePerWeek))} | ${man(t.impressionsPerWeek).replace("円", "回")} |`);
      lines.push("");
      lines.push(`**オプション**: 車内サンプリング（10,000個）${man(sell(600_000))}／マーケティングリサーチ ${man(sell(600_000))}`);
      return lines.join("\n");
    },
  },
  {
    id: "golfcart",
    name: "ゴルフカート広告（Golfcart Vision）",
    short: "ゴルフカートのナビ画面に、プレー中に届く",
    what: "ゴルフ場のカートに付いたナビ画面に動画・静止画の広告を流します。全国のRegular Adsと、ゴルフ場を選ぶSelect Adsがあります。掲載は週単位です。",
    fits: "経営者・富裕層・シニア向け商材（不動産、車、金融、健康、高級消費財）、ゴルフ場周辺の地元企業",
    caveats: ["表示回数は媒体社の想定値", "対象ゴルフ場は下の一覧の範囲。一覧にないゴルフ場は本部確認", "サンプリングは2,400個から"],
    simulatorPath: "/dashboard/golfcart-simulator",
    talk: ["最初の質問: 「お客様にゴルフをされる方は多いですか？」", "刺さる言い方: 「4時間のプレー中、目の前にある画面です」", "反論「規模が大きすぎる」→ Select Ads（ゴルフ場ごと・週5万円の販売価格）から"],
    facts: (pref) => {
      const lines: string[] = [];
      lines.push("**Regular Ads（全国・販売価格・税抜・1週あたり）**");
      lines.push("| メニュー | 1週の販売価格 | 想定表示回数／週 |\n|---|---|---|");
      for (const m of REGULAR_MENU.filter((x) => x.id !== "none")) lines.push(`| ${m.label} | ${man(sell(m.price))} | ${man(m.impressions).replace("円", "回")} |`);
      lines.push("");
      lines.push(`**Select Ads（ゴルフ場を選ぶ）**: 1ゴルフ場あたり ${man(sell(50_000))}／週（販売価格・税抜）`);
      lines.push(`**GolfBrand Contents**: 1週間 ${man(sell(200_000))}／4週間パック ${man(sell(600_000))}`);
      lines.push(`**タイアップコンテンツ**: ${man(sell(500_000))}／週`);
      lines.push(`**前ナビ広告配信**: 静止画15秒 ${man(sell(340_000))}／週、動画15秒 ${man(sell(800_000))}／週`);
      lines.push(`**オプション**: ゴルフ場サンプリング ${yen(sell(80))}／個（2,400個〜）／マーケティングリサーチ ${man(sell(600_000))}`);
      lines.push("");
      const mine = GOLF_COURSES.find((g) => samePref(pref, g.pref));
      lines.push("**対象ゴルフ場（県別の数）**: " + GOLF_COURSES.map((g) => `${g.pref}${g.courses.length}`).join("・"));
      if (mine) {
        lines.push(`\n**あなたの県のゴルフ場（${mine.pref}）**`);
        for (const c of mine.courses) lines.push(`- ${c.name}（カート${c.carts}台・${c.holes}H）`);
      }
      return lines.join("\n");
    },
  },
  {
    id: "omochannel",
    name: "おもチャンネル（アパホテル 客室TV）",
    short: "アパホテル全室のテレビで、宿泊客に届く",
    what: "アパホテルの客室テレビで流れる自社チャンネル「おもチャンネル」に CM を出します。全国・首都圏・関西のエリアと、日本語／インバウンド（30秒）の区分があります。インフォマーシャル（最大180秒）、ミラーリング前CM、VOD枠もあります。",
    fits: "出張者・旅行者向け（飲食、観光、交通、通販、採用）、インバウンド向け商材",
    caveats: ["部屋数は媒体社の公表値。視聴人数は保証しない", "「その他エリア」は単独価格なし（本部確認）", "インバウンド枠は30秒のみ・1週間の設定なし"],
    simulatorPath: "/dashboard/omochannel-simulator",
    talk: ["最初の質問: 「出張や旅行で来る人に、知ってほしいことはありますか？」", "刺さる言い方: 「ホテルの部屋で、テレビをつけた瞬間に流れます」", "反論「見られない」→ チェックイン直後に付ける導線（ミラーリング前CM）を添える"],
    facts: () => {
      const lines: string[] = [];
      lines.push(`**エリア**: ${(["national", "tokyo", "kansai"] as const).map((a) => `${AREA_META[a].label}（${AREA_META[a].sub}）`).join("／")}`);
      lines.push("");
      lines.push("**メインCM 日本語（販売価格・税抜）**");
      lines.push(`| エリア | 尺 | ${PERIODS.map((p) => p.label).join(" | ")} |\n|---|---|${PERIODS.map(() => "---").join("|")}|`);
      for (const a of ["national", "tokyo", "kansai"] as const) {
        for (const d of ["15s", "30s"] as const) {
          lines.push(`| ${AREA_META[a].label} | ${d.replace("s", "秒")} | ${PERIODS.map((p) => man(sell(JP_PRICES[a][d][p.id]))).join(" | ")} |`);
        }
      }
      lines.push("");
      lines.push("**インバウンドCM（30秒・販売価格・税抜）**");
      const ibP = PERIODS.filter((p) => p.id !== "1w");
      lines.push(`| エリア | ${ibP.map((p) => p.label).join(" | ")} |\n|---|${ibP.map(() => "---").join("|")}|`);
      for (const a of ["national", "tokyo", "kansai"] as const) lines.push(`| ${AREA_META[a].label} | ${ibP.map((p) => (IB_PRICES[a][p.id] ? man(sell(IB_PRICES[a][p.id]!)) : "—")).join(" | ")} |`);
      lines.push("");
      lines.push(`**インフォマーシャル（最大180秒・全国）** 日本語: ${INFO_PERIODS_JP.map((p) => `${p.label} ${man(sell(INFO_JP[p.id]))}`).join("／")}`);
      lines.push(`インバウンド: ${INFO_PERIODS_IB.map((p) => `${p.label} ${man(sell(INFO_IB[p.id] ?? 0))}`).join("／")}`);
      lines.push(`**ミラーリング前CM（15秒・日本語）**: ${man(sell(MIRRORING_MONTHLY))}／月`);
      lines.push(`**VOD無料コンテンツ枠（日本語）**: ${Object.entries(VOD_PRICES).map(([n, p]) => `${n}話 ${man(sell(p))}／月`).join("／")}`);
      return lines.join("\n");
    },
  },
  {
    id: "skylark",
    name: "すかいらーく インストア広告",
    short: "ガスト・バーミヤン・ジョナサンのテーブルで、食事中に届く",
    what: "ガスト・バーミヤン・ジョナサンの店内で、テーブルステッカー／テーブルスタンド／デジタルメニューブック（DMB）に広告を出します。100店舗から。掲載単位は4週間です。",
    fits: "ファミリー層・地域生活者向け（住宅、保険、通信、学習塾、地域小売、採用）",
    caveats: ["最低100店舗から。店舗は都道府県単位で選ぶ", "製作費は店舗数で単価が変わる（下の目安）", "デザイン制作費は別途"],
    simulatorPath: "/dashboard/skylark-simulator",
    talk: ["最初の質問: 「ファミリー層に、食事中に見てほしい商材はありますか？」", "刺さる言い方: 「注文を待つ数分間、テーブルの上にあります」", "反論「店舗が多すぎる」→ 近隣県だけで100店舗の組み方を見せる"],
    facts: (pref) => {
      const lines: string[] = [];
      const counts = [100, 300, 500, 1000];
      lines.push("**販売価格の目安（4週間・税抜・デザイン制作費別）**");
      lines.push("| 店舗数 | テーブルステッカー | テーブルスタンド |\n|---|---|---|");
      for (const c of counts) {
        const media = getMediaFeePerStore(c) * c;
        const st = sell(media + interpolateFee(c, STICKER_PROD_BPS) * c);
        const sd = sell(media + interpolateFee(c, STAND_PROD_BPS) * c);
        lines.push(`| ${c}店舗 | ${man(st)} | ${man(sd)} |`);
      }
      lines.push(`**デジタルメニューブック（DMB・3ブランド）**: ${man(sell(1_500_000))}（4週間・税抜）`);
      lines.push(`**デザイン制作費**: ${yen(SKYLARK_DESIGN_FEE)}（1案・税抜・別途）`);
      lines.push("");
      const byPref = new Map<string, number>();
      for (const s of SKYLARK_STORES) byPref.set(s.pref, (byPref.get(s.pref) ?? 0) + 1);
      const top = [...byPref.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
      lines.push("**店舗数（多い県）**: " + top.map(([p, n]) => `${p}${n}`).join("・"));
      if (pref) {
        const mine = [...byPref.entries()].find(([p]) => samePref(pref, p));
        if (mine) {
          const brands = new Map<string, number>();
          for (const s of SKYLARK_STORES.filter((x) => x.pref === mine[0])) brands.set(s.brand, (brands.get(s.brand) ?? 0) + 1);
          lines.push(`**あなたの県（${mine[0]}）**: ${mine[1]}店舗（${[...brands.entries()].map(([b, n]) => `${b}${n}`).join("・")}）`);
        }
      }
      return lines.join("\n");
    },
  },
  {
    id: "univ-coop",
    name: "大学生協 食堂トレイ広告",
    short: "大学の食堂トレイに、学生に毎日届く",
    what: "全国の大学生協の食堂で、トレイに敷く紙（トレイマット）に広告を印刷して配ります。食堂ごと・月ごとに枚数を決めます。",
    fits: "学生向け（採用・インターン、通信、金融、飲食、アプリ、資格・スクール）、大学周辺の地元企業",
    caveats: ["食堂ごとに枚数の下限・上限がある（本部確認）", "印刷単価は総枚数で変わる（下の目安）", "デザイン制作費は別途"],
    simulatorPath: "/dashboard/univ-coop-simulator",
    talk: ["最初の質問: 「学生の採用や、学生のお客様は増やしたいですか？」", "刺さる言い方: 「毎日の昼ごはんの、手元にあります」", "反論「効果が読めない」→ 1食堂・100枚／月・3ヶ月の小さい組み方から"],
    facts: (pref) => {
      const lines: string[] = [];
      lines.push(`**単価（税抜）**: 掲載費 ${yen(PLACEMENT_UNIT)}／枚、発送費 ${yen(SHIPPING_UNIT)}／食堂、印刷費は総枚数で変動、デザイン制作費 ${yen(UNIV_DESIGN_FEE)}／案（別途）`);
      lines.push("");
      lines.push("**販売価格の目安（税抜・デザイン制作費別）**");
      lines.push("| 組み方 | 総枚数 | 販売価格 |\n|---|---|---|");
      const ex = [[1, 100, 3], [3, 100, 3], [5, 200, 3], [10, 200, 6]] as const;
      for (const [stores, sheets, months] of ex) {
        const monthly = sheets * stores;
        const total = monthly * months;
        const unit = getPrintUnitPrice(total);
        if (unit == null) continue;
        const subtotal = PLACEMENT_UNIT * monthly * months + unit * total + SHIPPING_UNIT * stores;
        lines.push(`| ${stores}食堂・${sheets}枚／月・${months}ヶ月 | ${total.toLocaleString("ja-JP")}枚 | ${man(sell(subtotal))} |`);
      }
      lines.push("");
      const byPref = new Map<string, number>();
      for (const s of UNIV_STORES) byPref.set(s.pref, (byPref.get(s.pref) ?? 0) + 1);
      const top = [...byPref.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
      lines.push("**食堂数（多い県）**: " + top.map(([p, n]) => `${p}${n}`).join("・"));
      if (pref) {
        const mine = UNIV_STORES.filter((s) => samePref(pref, s.pref));
        if (mine.length) {
          const univs = [...new Set(mine.map((s) => s.univ))];
          lines.push(`**あなたの県（${mine[0].pref}）**: ${mine.length}食堂／${univs.length}大学（${univs.slice(0, 12).join("、")}${univs.length > 12 ? " ほか" : ""}）`);
        }
      }
      return lines.join("\n");
    },
  },
  {
    id: "aeon-cinema",
    name: "イオンシネマ 広告",
    short: "映画の本編前のスクリーンと、ロビーで届く",
    what: "全国のイオンシネマで、本編上映前のシネアド（15秒／30秒）と、ロビーのチラシ・ポスター・サンプリングを出します。劇場ごとに選べます。",
    fits: "ファミリー層・地域生活者向け（住宅、車、学校、地域小売、イベント告知）、劇場のある商圏の地元企業",
    caveats: ["素材のDCP変換費と配信費は実費（下に記載）", "上映作品・週数は劇場の編成に従う（本部確認）", "販売価格は劇場ごとに違う。下は劇場の料金の目安"],
    simulatorPath: "/dashboard/aeon-cinema-simulator",
    talk: ["最初の質問: 「お客様の商圏に、イオンシネマはありますか？」", "刺さる言い方: 「暗い場所で、大きな画面で、音付きで見られます」", "反論「高い」→ 1作品指定・2週間から。ロビーのチラシ設置は小さく始められる"],
    facts: (pref) => {
      const lines: string[] = [];
      lines.push(`**実費（税抜）**: DCP変換 ${yen(dcpFee(60))}／素材（60秒まで。60秒超は60秒ごと＋¥10,000）、配信費 5劇場まで ${yen(deliveryFee(1))}・6劇場以上は1劇場 ${yen(6_000)}`);
      lines.push(`**メニュー**: ${CINEMA_AD_COLS.map((c) => c.label).join("／")}。ロビー: チラシ設置・ポスター設置・専用什器・アンケート／サンプリング・デモンストレーション・入場時サンプリング（1部¥60・1,000部単位）`);
      lines.push("");
      const mine = pref ? AEON_THEATERS.filter((t) => samePref(pref, t.pref)) : [];
      const list = mine.length ? mine : AEON_THEATERS.slice(0, 8);
      lines.push(mine.length ? `**あなたの県の劇場（${mine[0].pref}・15秒シネアドの販売価格・税抜）**` : "**劇場の例（15秒シネアドの販売価格・税抜）。あなたの県の劇場はシミュレーターで**");
      lines.push("| 劇場 | 施設 | スクリーン数 | 1作品指定 2週間 | 1作品指定 4週間 | 全作品26週 月額 |\n|---|---|---|---|---|---|");
      for (const t of list) lines.push(`| イオンシネマ${t.name} | ${t.facility} | ${t.sc} | ${yen(sell(t.p15[0]))} | ${yen(sell(t.p15[1]))} | ${yen(sell(t.p15[4]))} |`);
      lines.push(`全国の劇場数: ${AEON_THEATERS.length}`);
      return lines.join("\n");
    },
  },
  {
    id: "tver-sim",
    name: "TVer広告（個別設計・再生回数ベース）",
    short: "商圏と再生回数を決めて、個別に設計するTVer出稿",
    what: "TVer（民放公式のテレビ配信サービス）に、市区町村単位でエリアを指定して CM を配信します。再生回数または予算から設計し、秒数（6／15／30／45／60秒）を組み合わせられます。パッケージ（月額固定）と違い、案件ごとに個別設計します。",
    fits: "テレビCMを地域限定で試したい企業全般（住宅、車、医療、学校、小売、採用）",
    caveats: ["リーチは「人口×TVer普及率÷1人あたり回数」の推計。保証しない", "TVer側の考査がある（業種・表現によって出稿できない場合がある）", "手数料（媒体管理費・考査費・初期取引費）はお客様に事前に伝える"],
    simulatorPath: "/dashboard/tver-simulator",
    talk: ["最初の質問: 「お客さまは、だいたいどの市からいらっしゃいますか？」", "刺さる言い方: 「テレビCMを、御社の市だけに絞って出せます」", "反論「効果が分からない」→ 月次レポート（再生数・完全視聴率・エリア内訳）を実物で見せる"],
    facts: () => {
      const lines: string[] = [];
      lines.push("**再生単価（税抜・秒数別）**");
      lines.push("| 秒数 | 1再生あたり | 1,000再生あたり |\n|---|---|---|");
      for (const f of AD_FORMATS) lines.push(`| ${f.label}${f.note ? `（${f.note}）` : ""} | ¥${(sellCpm(f.seconds) / 1000).toFixed(1)} | ${yen(sellCpm(f.seconds))} |`);
      lines.push("");
      const fee = calcAdArchFees(500_000, true, 1);
      lines.push(`**手数料（税抜）**: 媒体管理費＝媒体費50万円以下は ${yen(fee.managementFee)}、50万円超は媒体費の20%／クリエイティブ考査費 ${yen(30_000)}／本／初期取引費（業態考査含む・初回のみ） ${yen(fee.initialFee)}`);
      lines.push(`**例**: 15秒・媒体費50万円・初回・素材1本 → 再生 ${Math.round(500_000 / (sellCpm(15) / 1000)).toLocaleString("ja-JP")}回、手数料 ${yen(fee.subtotal)}、総額 ${yen(500_000 + fee.subtotal)}`);
      lines.push(`**リーチの考え方**: 指定エリアの人口 × TVer普及率${Math.round(TVER_PENETRATION * 100)}% ÷ 1人あたりの再生回数（標準3回）＝届く人数の上限（推計）`);
      return lines.join("\n");
    },
  },
];

export function getMedium(id: string): MediumDef | undefined {
  return MEDIA.find((m) => m.id === id);
}
