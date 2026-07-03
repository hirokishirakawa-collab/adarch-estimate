-- 契約更新期限アラート: GroupCompany に通知済みステージを追加（追加のみ・非破壊）
ALTER TABLE "group_companies" ADD COLUMN "renewalAlertStage" TEXT;
