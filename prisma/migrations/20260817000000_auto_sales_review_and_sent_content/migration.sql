-- 自動営業（auto-sales）のWeb完結版 再稼働にあたっての追加。
--
-- 目的は2つ。
--   ① 申請制: 拠点が作った営業テンプレートは、本部が承認するまで送信されない。
--      既存の isApproved / approvedAt / approvedBy に、申請日時・差戻し日時・本部コメントを足す。
--   ② 内容把握: 「どんな内容で送ったか」を本部が後から確認できるようにする。
--      これまで filledData（CSSセレクタ→値）にしか残らず、実際の本文が読み取りづらかった。
--      変数置換後の本文と、AIが相手サイトから読み取った一言を、ジョブ単位で保存する。
--
-- 追加のみ。既存カラム・既存データは不変。全て NULL 許容なので backfill は不要。
--
-- 既存テンプレートの扱い:
--   閉鎖前(2026-05-23以前)に作られた行は isApproved = true のまま残っている。
--   これらは submittedAt / approvedAt が埋まっていない可能性があるため、
--   isApproved = true の行に限り submittedAt を createdAt で埋めておく。
--   （申請一覧の並び順が壊れないようにするためで、承認状態そのものは変えない）

-- AlterTable: 申請制
-- dailyLimit は1アカウントの1日の送信上限。既定200件、無制限は認めない。
-- 1社が突出して送りすぎるとグループ全体の毀損になるため、構造として上限を必ず持たせる。
ALTER TABLE "auto_sales_templates"
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt"  TIMESTAMP(3),
  ADD COLUMN "reviewNote"  TEXT,
  ADD COLUMN "dailyLimit"  INTEGER NOT NULL DEFAULT 200;

-- AlterTable: 送信内容の記録
-- sentFromEmail は、そのジョブでフォームに入れた返信先アドレス。
-- 拠点ごとに @adarch.co.jp のアドレスが違うので、反響をどの受信箱で拾うかの手がかりになる。
ALTER TABLE "auto_sales_jobs"
  ADD COLUMN "sentBody"       TEXT,
  ADD COLUMN "companyInsight" TEXT,
  ADD COLUMN "sentFromEmail"  TEXT;

CREATE INDEX "auto_sales_jobs_sentFromEmail_idx" ON "auto_sales_jobs"("sentFromEmail");

-- Backfill: 既に承認済みの既存テンプレートに申請日時を補う
UPDATE "auto_sales_templates"
SET "submittedAt" = "createdAt"
WHERE "isApproved" = true AND "submittedAt" IS NULL;

-- 返信先アドレスが未設定の承認済みテンプレートは、いったん承認を取り消す。
-- 新ルールでは返信先が必須で、ワーカーもこの状態のテンプレートの送信を拒否する。
-- 承認済みのまま残すと、拠点が営業開始で選べてしまい、積んだジョブが全部 FAILED になる。
-- 差戻し扱いにして、理由を拠点の画面に出す。
UPDATE "auto_sales_templates"
SET "isApproved" = false,
    "approvedAt" = NULL,
    "approvedBy" = NULL,
    "rejectedAt"  = CURRENT_TIMESTAMP,
    "reviewNote"  = '返信先アドレスが未設定のため、いったん承認を取り消しました。拠点の @adarch.co.jp アドレスを設定のうえ再申請してください。相手からの返信はこのアドレスに届きます。'
WHERE "isApproved" = true AND COALESCE(TRIM("email"), '') = '';

-- ==============================================================
-- 二重送信の防止 ＋ 全社共有の送付履歴
--
-- 「同じ会社に二重に送らない」の判定は URL ではなくドメインで行う。
-- 拠点Aが /contact、拠点Bが /inquiry に送っても会社は同じだから。
-- ==============================================================

-- AlterTable: 営業先に正規化ドメインを持たせる
ALTER TABLE "auto_sales_targets" ADD COLUMN "domain" TEXT;
CREATE INDEX "auto_sales_targets_domain_idx" ON "auto_sales_targets"("domain");

-- Backfill: 既存の url からホスト名を取り出す。
--   'https://www.example.co.jp/contact?a=1' → 'example.co.jp'
--   'http://B-Corp.JP:8080/form#top'        → 'b-corp.jp'
-- スキーム除去 → 先頭の www. 除去 → 最初の / ? # までを取る → ポート番号を落とす → 小文字化。
--
-- ここは src/lib/auto-sales-domain.ts の normalizeDomain() と同じ結果にならなければならない。
-- 食い違うと、既存行の domain が実行時に計算した値と一致せず、二重送信ガードをすり抜ける。
-- （TS 側は URL.hostname を使うのでポートは元から含まれない。SQL 側で明示的に落としている）
-- LOWER() は最初に掛ける。最後に掛けると 'HTTPS://WWW.UPPER.COM' の 'WWW.' が
-- 大文字のままで '^www\.' に一致せず、実行時の値（upper.com）とずれる。
UPDATE "auto_sales_targets"
SET "domain" =
  SPLIT_PART(
    SPLIT_PART(
      SPLIT_PART(
        SPLIT_PART(
          REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER("url"), '^[a-z][a-z0-9+.-]*://', ''),
            '^www\.', ''
          ),
          '/', 1
        ),
        '?', 1
      ),
      '#', 1
    ),
    ':', 1
  )
WHERE "domain" IS NULL AND "url" <> '';

-- 空文字になったものは NULL に戻す（判定から外すため）
UPDATE "auto_sales_targets" SET "domain" = NULL WHERE "domain" = '';

-- CreateTable: 全社共有の送信済み台帳。domain の UNIQUE が二重送信ガードそのもの。
CREATE TABLE "auto_sales_sent_domains" (
  "id"          TEXT NOT NULL,
  "domain"      TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "branchId"    TEXT NOT NULL,
  "jobId"       TEXT NOT NULL,
  "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hasResponse" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "auto_sales_sent_domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auto_sales_sent_domains_domain_key" ON "auto_sales_sent_domains"("domain");
CREATE INDEX "auto_sales_sent_domains_branchId_idx" ON "auto_sales_sent_domains"("branchId");
CREATE INDEX "auto_sales_sent_domains_sentAt_idx" ON "auto_sales_sent_domains"("sentAt");

ALTER TABLE "auto_sales_sent_domains"
  ADD CONSTRAINT "auto_sales_sent_domains_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: 過去に送信成功した実績を台帳に載せる。
-- 同一ドメインに複数の成功ジョブがある場合は最も古い1件を採用（先に送った拠点を正とする）。
INSERT INTO "auto_sales_sent_domains" ("id", "domain", "companyName", "branchId", "jobId", "sentAt", "hasResponse")
SELECT DISTINCT ON (tg."domain")
  'asd_' || j."id",
  tg."domain",
  tg."companyName",
  tg."branchId",
  j."id",
  COALESCE(j."completedAt", j."createdAt"),
  j."hasResponse"
FROM "auto_sales_jobs" j
JOIN "auto_sales_targets" tg ON tg."id" = j."targetId"
WHERE j."status" = 'COMPLETED' AND tg."domain" IS NOT NULL
ORDER BY tg."domain", COALESCE(j."completedAt", j."createdAt") ASC;
