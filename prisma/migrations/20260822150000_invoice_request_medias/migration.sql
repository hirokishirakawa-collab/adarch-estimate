-- 媒体請求は1件で複数の媒体を回すことがあるため、媒体を行で持てるようにする。
-- 媒体ごとに媒体側へ支払う実費が違い、それが本部手数料を決める判断材料になる。
--
-- 単一の mediaName は本日追加したばかりで実データが1件も無いため落とす（二重管理を残さない）。
CREATE TABLE IF NOT EXISTS "invoice_request_medias" (
    "id"               TEXT NOT NULL,
    "invoiceRequestId" TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "costExclTax"      DECIMAL(15,0) NOT NULL DEFAULT 0,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_request_medias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "invoice_request_medias_invoiceRequestId_idx"
    ON "invoice_request_medias"("invoiceRequestId");

DO $$ BEGIN
  ALTER TABLE "invoice_request_medias"
    ADD CONSTRAINT "invoice_request_medias_invoiceRequestId_fkey"
    FOREIGN KEY ("invoiceRequestId") REFERENCES "invoice_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "invoice_requests" DROP COLUMN IF EXISTS "mediaName";
