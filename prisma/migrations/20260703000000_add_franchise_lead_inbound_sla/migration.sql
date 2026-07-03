-- 加盟リード管理: インバウンド起票（LPフォーム）と SLA 監視フィールドを追加
-- すべて追加のみ（既存行・既存アプリに影響なし）。既存行は source='OUTBOUND'＝発掘リード扱い。

ALTER TABLE "franchise_leads"
  ADD COLUMN "source"         TEXT NOT NULL DEFAULT 'OUTBOUND',
  ADD COLUMN "revenueRange"   TEXT,
  ADD COLUMN "slaAlertStage"  TEXT,
  ADD COLUMN "slaLastAlertAt" TIMESTAMP(3);

CREATE INDEX "franchise_leads_source_idx" ON "franchise_leads"("source");
