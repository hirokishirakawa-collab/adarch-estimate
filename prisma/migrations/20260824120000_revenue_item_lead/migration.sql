-- 月次報告の明細行を「受注」リードと紐づける（取り込みの二重登録防止）
ALTER TABLE "revenue_report_items" ADD COLUMN "leadId" TEXT;
CREATE INDEX "revenue_report_items_leadId_idx" ON "revenue_report_items"("leadId");
ALTER TABLE "revenue_report_items" ADD CONSTRAINT "revenue_report_items_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
