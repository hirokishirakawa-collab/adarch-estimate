#!/usr/bin/env python3
"""
アドアーチグループ ターゲット企業自動収集スクリプト v2
Google Places API + フォームURL自動探索（強化版）

【セットアップ】
pip install googlemaps requests beautifulsoup4 pandas lxml

【Google API Key 取得】
1. https://console.cloud.google.com/ にアクセス
2. プロジェクト作成 → 「Places API」を有効化
3. 認証情報 → APIキーを作成
4. 下の GOOGLE_API_KEY に貼り付け

【実行】
python collect_targets.py

【出力】
targets_YYYYMMDD_HHMM.csv → form-sales.html の「CSVインポート」で使用
"""

import googlemaps
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import sys
import re
from datetime import datetime
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

# ============================================================
# 設定
# ============================================================
GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY_HERE"  # ← ここにAPIキーを入力

# ターゲット設定: (検索キーワード, 業種ラベル, 地域, 件数, 媒体)
# 媒体: "動画制作" / "TVer広告" / "イオンシネマ広告" / "タクシーサイネージ" / "デジタルサイネージ"
TARGETS = [
    # --- 動画制作 ---
    ("不動産会社",          "不動産・建設",            "東京都",   20, "動画制作"),
    ("不動産会社",          "不動産・建設",            "大阪府",   15, "動画制作"),
    ("歯科医院",            "医療・クリニック・歯科",   "東京都",   20, "動画制作"),
    ("クリニック 内科",     "医療・クリニック・歯科",   "神奈川県", 15, "動画制作"),
    ("レストラン",          "飲食・レストラン・カフェ", "東京都",   15, "動画制作"),
    ("ウェディング 式場",   "ブライダル・ウェディング", "東京都",   10, "動画制作"),
    ("美容室 サロン",       "美容・エステ・サロン",     "東京都",   15, "動画制作"),
    ("学習塾",              "教育・学習塾・スクール",   "東京都",   15, "動画制作"),

    # --- TVer広告 ---
    ("ECサイト 通販会社",   "小売・EC・ショッピング",   "東京都",   10, "TVer広告"),
    ("IT企業 SaaS",         "IT・テクノロジー・SaaS",   "東京都",   10, "TVer広告"),
    ("保険会社",            "金融・保険・ファイナンス", "東京都",    8, "TVer広告"),

    # --- イオンシネマ広告 ---
    ("飲食チェーン",        "飲食・レストラン・カフェ", "東京都",   10, "イオンシネマ広告"),
    ("自動車ディーラー",    "自動車・ディーラー",       "愛知県",   10, "イオンシネマ広告"),
    ("ショッピングモール 小売", "小売・EC・ショッピング", "大阪府",  8, "イオンシネマ広告"),

    # --- タクシーサイネージ ---
    ("会計事務所 税理士",   "金融・保険・ファイナンス", "東京都",   10, "タクシーサイネージ"),
    ("採用 人材会社",       "採用・HR・人材",           "東京都",   10, "タクシーサイネージ"),
    ("ITコンサル",          "IT・テクノロジー・SaaS",   "東京都",    8, "タクシーサイネージ"),
]

# フォームURLを探す際に試すパス（優先度順）
CONTACT_PATHS = [
    "/contact", "/inquiry", "/form", "/contact-us", "/contactus",
    "/contact.html", "/inquiry.html", "/contact.php", "/form.php",
    "/お問い合わせ", "/toiawase",
    "/contact/", "/inquiry/", "/form/",
    "/pages/contact", "/about/contact",
    "/?page_id=", # WordPress fallback
    "/#contact", "/#inquiry", "/#form",
]

# お問い合わせを示すキーワード
CONTACT_KEYWORDS_JP = [
    "お問い合わせ", "問合せ", "問い合わせ", "フォーム",
    "ご相談", "ご連絡", "連絡先", "お申込み", "申込み",
    "contact", "inquiry", "form", "reach us", "get in touch",
]

# フォームページのURLに含まれるキーワード
CONTACT_URL_KEYWORDS = [
    "contact", "inquiry", "form", "reach", "touch",
    "お問い合わせ", "toiawase", "問合せ",
]

REQUEST_TIMEOUT   = 8
INTERVAL_PLACES   = 0.3   # Places API呼び出し間隔（秒）
INTERVAL_CRAWL    = 1.2   # サイトクロール間隔（秒）
MAX_CONTACT_TRIES = 8     # 直接パス試行の最大数

# ============================================================
# メイン処理
# ============================================================

def main():
    if GOOGLE_API_KEY == "YOUR_GOOGLE_API_KEY_HERE":
        print("❌ エラー: GOOGLE_API_KEY を設定してください")
        print("   https://console.cloud.google.com/ でAPIキーを取得し、")
        print("   このファイルの GOOGLE_API_KEY に貼り付けてください。")
        sys.exit(1)

    gmaps = googlemaps.Client(key=GOOGLE_API_KEY)
    results = []

    print("=" * 65)
    print("アドアーチグループ ターゲット企業収集ツール v2")
    print("=" * 65)

    for keyword, industry, region, max_count, media in TARGETS:
        print(f"\n📍 [{media}] [{region}] {keyword} を収集中... (最大{max_count}件)")

        places = search_places(gmaps, keyword, region, max_count)
        print(f"   → {len(places)} 件見つかりました")

        for i, place in enumerate(places):
            name = place.get("name", "")
            print(f"   [{i+1}/{len(places)}] {name}...", end=" ", flush=True)

            website = place.get("website", "")
            form_url = ""

            if website:
                form_url = find_contact_form(website)

            tmpl_name = media_industry_to_template(media, industry)

            row = {
                "会社名":       name,
                "担当者名":     "",
                "業種":         industry,
                "地域":         region,
                "規模":         estimate_scale(place),
                "フォームURL":  form_url or website,
                "メール":       "",
                "電話":         place.get("formatted_phone_number", ""),
                "テンプレート名": tmpl_name,
                "メモ":         f"[{media}] 住所:{place.get('vicinity','')} 評価:{place.get('rating','')}",
                "状態":         "未送信",
                "媒体":         media,
            }
            results.append(row)

            if form_url:
                status = "✅ フォームURL"
            elif website:
                status = "🌐 サイトのみ"
            else:
                status = "❌ URL無し"
            print(status)

            time.sleep(INTERVAL_CRAWL)

    if not results:
        print("\n⚠️ データが取得できませんでした。")
        return

    df = pd.DataFrame(results)
    out_file = f"targets_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    df.to_csv(out_file, index=False, encoding="utf-8-sig")

    # サマリー
    print("\n" + "=" * 65)
    print(f"✅ 完了！ {len(df)} 件収集")
    print(f"📄 出力: {out_file}")
    df_form = df[df["フォームURL"].str.startswith("http", na=False)]
    print(f"\n📊 フォームURL取得率: {len(df_form)}/{len(df)} 件 "
          f"({len(df_form)*100//len(df) if len(df) else 0}%)")
    print("\n媒体別:")
    for m, cnt in df["媒体"].value_counts().items():
        print(f"   {m}: {cnt}件")
    print("\n業種別:")
    for ind, cnt in df["業種"].value_counts().items():
        print(f"   {ind}: {cnt}件")
    print("=" * 65)
    print("→ form-sales.html の「CSVインポート」で読み込んでください")


# ============================================================
# Google Places検索
# ============================================================

def search_places(gmaps, keyword, region, max_count):
    places = []
    query = f"{keyword} {region}"
    try:
        response = gmaps.places(query=query, language="ja", region="JP")
        places.extend(response.get("results", []))

        page_count = 1
        while "next_page_token" in response and len(places) < max_count and page_count < 3:
            time.sleep(2.2)
            response = gmaps.places(
                query=query, language="ja", region="JP",
                page_token=response["next_page_token"]
            )
            places.extend(response.get("results", []))
            page_count += 1
    except Exception as e:
        print(f"\n   ⚠️ Places API エラー: {e}")
        return []

    detailed = []
    for place in places[:max_count]:
        try:
            detail = gmaps.place(
                place_id=place["place_id"],
                fields=["name","website","formatted_phone_number",
                        "vicinity","rating","user_ratings_total"],
                language="ja"
            )
            detailed.append(detail.get("result", place))
            time.sleep(INTERVAL_PLACES)
        except Exception:
            detailed.append(place)
    return detailed


# ============================================================
# フォームURL探索（強化版）
# ============================================================

def find_contact_form(website_url):
    """ウェブサイトからお問い合わせフォームURLを探す（4段階戦略）"""
    base = normalize_url(website_url)
    if not base:
        return ""

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/121.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    # 戦略1: sitemap.xml からお問い合わせページURLを直接発見
    url = find_via_sitemap(base, headers)
    if url:
        return url

    # 戦略2: トップページのナビゲーションリンクから探す
    url = find_in_links(base, headers)
    if url:
        return url

    # 戦略3: よくあるパスを試し、<form>要素があるか確認
    url = try_common_paths_with_form_check(base, headers)
    if url:
        return url

    # 戦略4: formなくてもURLが存在すれば返す（問い合わせページの可能性）
    url = try_common_paths_exist(base, headers)
    return url


def find_via_sitemap(base_url, headers):
    """sitemap.xml / sitemap_index.xml から問い合わせURLを探す"""
    sitemap_candidates = [
        "/sitemap.xml",
        "/sitemap_index.xml",
        "/sitemap/",
        "/wp-sitemap.xml",   # WordPress
        "/sitemap-pages.xml",
    ]
    for spath in sitemap_candidates:
        try:
            resp = requests.get(
                urljoin(base_url, spath), headers=headers,
                timeout=5, allow_redirects=True
            )
            if resp.status_code != 200:
                continue
            ct = resp.headers.get("content-type","")
            if "xml" not in ct and not resp.text.strip().startswith("<?xml"):
                continue

            # XML パース
            root = ET.fromstring(resp.content)
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

            # sitemap index の場合、子サイトマップも確認
            for sitemap in root.findall(".//sm:sitemap/sm:loc", ns):
                child_url = sitemap.text or ""
                if any(kw in child_url.lower() for kw in ["page","contact","inquiry"]):
                    url = find_via_sitemap_url(child_url, headers)
                    if url:
                        return url

            for loc in root.findall(".//sm:url/sm:loc", ns):
                url = (loc.text or "").strip()
                if is_contact_url(url):
                    return url
        except Exception:
            pass
    return ""


def find_via_sitemap_url(sitemap_url, headers):
    """指定したサイトマップURLのlocを解析してcontactURLを返す"""
    try:
        resp = requests.get(sitemap_url, headers=headers, timeout=5)
        if resp.status_code != 200:
            return ""
        root = ET.fromstring(resp.content)
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for loc in root.findall(".//sm:url/sm:loc", ns):
            url = (loc.text or "").strip()
            if is_contact_url(url):
                return url
    except Exception:
        pass
    return ""


def find_in_links(base_url, headers):
    """トップページのリンクからお問い合わせページを見つける"""
    try:
        resp = requests.get(base_url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        if resp.status_code != 200:
            return ""

        soup = BeautifulSoup(resp.text, "html.parser")
        base_domain = urlparse(base_url).netloc

        # ナビゲーション・フッターのリンクを優先的に確認
        priority_areas = (
            soup.find_all("nav") +
            soup.find_all("footer") +
            soup.find_all(class_=re.compile(r"nav|menu|footer|header", re.I))
        )
        # priority_areasが空の場合は全リンクを検索
        search_areas = priority_areas if priority_areas else [soup]

        for area in search_areas:
            for a in area.find_all("a", href=True):
                href = (a.get("href") or "").strip()
                text = a.get_text(strip=True)
                full_url = urljoin(base_url, href)

                # 同一ドメインに限定
                if urlparse(full_url).netloc != base_domain:
                    continue

                # URLかテキストにお問い合わせキーワードがあればOK
                combined = (href + " " + text).lower()
                if any(kw.lower() in combined for kw in CONTACT_KEYWORDS_JP):
                    return full_url

    except Exception:
        pass
    return ""


def try_common_paths_with_form_check(base_url, headers):
    """よくあるパスを試し、<form>要素がある場合に返す"""
    for path in CONTACT_PATHS[:MAX_CONTACT_TRIES]:
        candidate = urljoin(base_url, path)
        try:
            resp = requests.get(
                candidate, headers=headers,
                timeout=REQUEST_TIMEOUT, allow_redirects=True
            )
            if resp.status_code != 200:
                continue
            soup = BeautifulSoup(resp.text, "html.parser")
            # input/textarea/selectを含むformがあればOK
            for form in soup.find_all("form"):
                if form.find(["input", "textarea", "select"]):
                    return resp.url  # リダイレクト後のURLを使用
        except Exception:
            pass
    return ""


def try_common_paths_exist(base_url, headers):
    """<form>なしでも200が返るパスを返す（フォールバック）"""
    for path in CONTACT_PATHS[:5]:
        candidate = urljoin(base_url, path)
        try:
            resp = requests.head(
                candidate, headers=headers,
                timeout=5, allow_redirects=True
            )
            if resp.status_code == 200:
                return resp.url
        except Exception:
            pass
    return ""


def is_contact_url(url):
    """URLがお問い合わせページっぽいか判定"""
    url_lower = url.lower()
    return any(kw in url_lower for kw in CONTACT_URL_KEYWORDS)


def normalize_url(url):
    if not url:
        return ""
    if not url.startswith("http"):
        url = "https://" + url
    return url.rstrip("/")


# ============================================================
# ユーティリティ
# ============================================================

def estimate_scale(place):
    ratings = place.get("user_ratings_total", 0) or 0
    if ratings > 500:   return "大企業（300名以上）"
    if ratings > 200:   return "中堅企業（100〜299名）"
    if ratings > 50:    return "中小企業（30〜99名）"
    if ratings > 10:    return "小規模事業者（10〜29名）"
    return "零細・個人事業（〜9名）"


def media_industry_to_template(media, industry):
    mapping = {
        ("TVer広告", "小売・EC・ショッピング"):    "【TVer】EC・小売向け動画広告提案",
        ("TVer広告", "IT・テクノロジー・SaaS"):    "【TVer】IT・SaaS向け動画広告提案",
        ("TVer広告", "金融・保険・ファイナンス"):   "【TVer】金融向け動画広告提案",
        ("イオンシネマ広告", "飲食・レストラン・カフェ"): "【イオンシネマ】飲食向けスクリーン広告提案",
        ("イオンシネマ広告", "自動車・ディーラー"):  "【イオンシネマ】自動車向けスクリーン広告提案",
        ("イオンシネマ広告", "小売・EC・ショッピング"): "【イオンシネマ】小売向けスクリーン広告提案",
        ("タクシーサイネージ", "金融・保険・ファイナンス"): "【タクシー】金融・士業向けサイネージ提案",
        ("タクシーサイネージ", "採用・HR・人材"):   "【タクシー】採用・HR向けサイネージ提案",
        ("タクシーサイネージ", "IT・テクノロジー・SaaS"): "【タクシー】IT向けサイネージ提案",
        ("動画制作", "不動産・建設"):              "【不動産】物件紹介・内覧動画提案",
        ("動画制作", "医療・クリニック・歯科"):     "【医療・歯科】クリニック紹介動画提案",
        ("動画制作", "飲食・レストラン・カフェ"):   "【飲食】料理・雰囲気紹介動画提案",
    }
    return mapping.get((media, industry), "【汎用】会社PR・採用動画提案")


if __name__ == "__main__":
    main()
