-- グループ請求書に「取消」を追加する。
-- 発行済・入金済の請求書は削除できない（発行の記録を残す必要があるため）。
-- 誤発行はこのステータスで取り消し、理由と日時を残す。実行者は audit_logs 側に記録される。
--
-- 追加のみ。既存行は status を変えないため、現行の表示・集計は変わらない。

-- AlterEnum
ALTER TYPE "GroupInvoiceStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "group_invoices"
  ADD COLUMN "cancelledAt"  TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT;
