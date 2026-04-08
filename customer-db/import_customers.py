"""
顧客管理マスターCSVをSQLiteデータベースにインポートするスクリプト。
メールアドレスから拠点を自動生成し、担当者・顧客データを反映する。
"""

import csv
import sqlite3
from pathlib import Path
from datetime import datetime

CSV_PATH = "/Users/hirokishirakawa/Desktop/[100] 顧客管理マスター_20260221T164746+0900.csv"
DB_PATH  = Path(__file__).parent / "customers.db"

# ─── メール → 拠点マッピング ───────────────────────────────────────────────────

EMAIL_TO_BRANCH = {
    "fujiwara@adarch.co.jp":        {"name": "神奈川拠点",    "region": "関東",   "prefectures": "神奈川県"},
    "hamaguchi@adarch.co.jp":       {"name": "福岡拠点",      "region": "九州",   "prefectures": "福岡県"},
    "hiroki.shirakawa@adarch.co.jp":{"name": "東京拠点",      "region": "関東",   "prefectures": "東京都"},
    "ibaraki@adarch.co.jp":         {"name": "茨城拠点",      "region": "関東",   "prefectures": "茨城県"},
    "ishikawa@adarch.co.jp":        {"name": "石川拠点",      "region": "北陸",   "prefectures": "石川県"},
    "kagawa_okayama@adarch.co.jp":  {"name": "香川・岡山拠点", "region": "中国四国","prefectures": "香川県・岡山県"},
    "katagiri@adarch.co.jp":        {"name": "東京拠点",      "region": "関東",   "prefectures": "東京都"},
    "mtakahashi@adarch.co.jp":      {"name": "京都拠点",      "region": "近畿",   "prefectures": "京都府"},
    "okinawa@adarch.co.jp":         {"name": "沖縄拠点",      "region": "九州",   "prefectures": "沖縄県"},
    "s.keita@adarch.co.jp":         {"name": "北海道拠点",    "region": "北海道", "prefectures": "北海道"},
    "takashi.miyamoto@adarch.co.jp":{"name": "東京拠点",      "region": "関東",   "prefectures": "東京都"},
    "tokushima@adarch.co.jp":       {"name": "徳島拠点",      "region": "中国四国","prefectures": "徳島県"},
    "toru.shiraishi@adarch.co.jp":  {"name": "東京拠点",      "region": "関東",   "prefectures": "東京都"},
    "shoma.utamaru@adarch.co.jp":   {"name": "山口・広島拠点", "region": "中国四国","prefectures": "山口県・広島県"},
}

# ─── DB初期化 ─────────────────────────────────────────────────────────────────

def init_db(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS branches (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL UNIQUE,
            region     TEXT NOT NULL,
            prefectures TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL UNIQUE,
            branch_id  INTEGER NOT NULL REFERENCES branches(id),
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customers (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            record_number       INTEGER,
            company_name        TEXT NOT NULL,
            company_name_kana   TEXT,
            industry            TEXT,
            customer_rank       TEXT,
            deal_status         TEXT,
            company_url         TEXT,
            corporate_number    TEXT,
            phone               TEXT,
            inflow_route        TEXT,
            prefecture          TEXT,
            postal_code         TEXT,
            address             TEXT,
            building            TEXT,
            user_email          TEXT,
            branch_id           INTEGER REFERENCES branches(id),
            source_created_at   TEXT,
            source_updated_at   TEXT,
            imported_at         TEXT NOT NULL
        );
    """)
    conn.commit()

# ─── インポート処理 ────────────────────────────────────────────────────────────

def import_data(conn: sqlite3.Connection, csv_path: str):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. 拠点を登録
    branch_name_to_id = {}
    for email, info in EMAIL_TO_BRANCH.items():
        conn.execute("""
            INSERT OR IGNORE INTO branches (name, region, prefectures, created_at)
            VALUES (?, ?, ?, ?)
        """, (info["name"], info["region"], info["prefectures"], now))
    conn.commit()

    for row in conn.execute("SELECT id, name FROM branches"):
        branch_name_to_id[row[1]] = row[0]

    # 2. 担当者を登録
    for email, info in EMAIL_TO_BRANCH.items():
        branch_id = branch_name_to_id[info["name"]]
        conn.execute("""
            INSERT OR IGNORE INTO users (email, branch_id, created_at)
            VALUES (?, ?, ?)
        """, (email, branch_id, now))
    conn.commit()

    # 3. 顧客データを登録
    with open(csv_path, encoding="shift_jis", errors="replace") as f:
        reader = csv.DictReader(f)
        customers = list(reader)

    inserted = 0
    skipped  = 0
    for row in customers:
        email     = row["ユーザー選択"].strip()
        branch_info = EMAIL_TO_BRANCH.get(email)
        branch_id   = branch_name_to_id.get(branch_info["name"]) if branch_info else None

        try:
            conn.execute("""
                INSERT INTO customers (
                    record_number, company_name, company_name_kana,
                    industry, customer_rank, deal_status,
                    company_url, corporate_number, phone,
                    inflow_route, prefecture, postal_code,
                    address, building, user_email,
                    branch_id, source_created_at, source_updated_at, imported_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                int(row["レコード番号"]) if row["レコード番号"].strip() else None,
                row["会社名"].strip(),
                row["会社名（フリガナ）"].strip(),
                row["業種"].strip(),
                row["顧客ランク"].strip(),
                row["取引ステータス"].strip(),
                row["企業URL"].strip(),
                row["法人番号（インボイス）"].strip(),
                row["代表電話番号"].strip(),
                row["流入経路"].strip(),
                row["都道府県"].strip(),
                row["郵便番号"].strip(),
                row["住所"].strip(),
                row["ビル名・階数"].strip(),
                email,
                branch_id,
                row["作成日時"].strip(),
                row["更新日時"].strip(),
                now,
            ))
            inserted += 1
        except Exception as e:
            print(f"  ⚠ スキップ: {row['会社名']} ({e})")
            skipped += 1

    conn.commit()
    return inserted, skipped

# ─── レポート出力 ──────────────────────────────────────────────────────────────

def print_report(conn: sqlite3.Connection):
    print("\n" + "="*60)
    print("■ 拠点一覧")
    print("="*60)
    for row in conn.execute("""
        SELECT b.name, b.region, b.prefectures, COUNT(c.id) as cnt
        FROM branches b
        LEFT JOIN customers c ON c.branch_id = b.id
        GROUP BY b.id
        ORDER BY cnt DESC
    """):
        print(f"  {row[0]}（{row[1]}）: {row[3]}件 [{row[2]}]")

    print("\n" + "="*60)
    print("■ 担当者別件数")
    print("="*60)
    for row in conn.execute("""
        SELECT u.email, b.name, COUNT(c.id) as cnt
        FROM users u
        JOIN branches b ON b.id = u.branch_id
        LEFT JOIN customers c ON c.user_email = u.email
        GROUP BY u.id
        ORDER BY cnt DESC
    """):
        print(f"  {row[0]} → {row[1]}: {row[2]}件")

    print("\n" + "="*60)
    print("■ 顧客ランク別集計")
    print("="*60)
    for row in conn.execute("""
        SELECT customer_rank, COUNT(*) as cnt
        FROM customers
        GROUP BY customer_rank
        ORDER BY cnt DESC
    """):
        print(f"  {row[0]}: {row[1]}件")

    print("\n" + "="*60)
    print("■ 業種別集計（上位10）")
    print("="*60)
    for row in conn.execute("""
        SELECT industry, COUNT(*) as cnt
        FROM customers
        GROUP BY industry
        ORDER BY cnt DESC
        LIMIT 10
    """):
        print(f"  {row[0]}: {row[1]}件")

# ─── メイン ───────────────────────────────────────────────────────────────────

def main():
    print("=== 顧客データインポート開始 ===")

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    inserted, skipped = import_data(conn, CSV_PATH)

    print(f"\n✅ インポート完了: {inserted}件登録 / {skipped}件スキップ")
    print_report(conn)

    conn.close()
    print(f"\nDB保存先: {DB_PATH}")

if __name__ == "__main__":
    main()
