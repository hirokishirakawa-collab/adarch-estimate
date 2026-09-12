-- 単価の条件が特殊な案件を、全社の単価の目安（分析・ベンチマーク）から外す印
ALTER TABLE "tver_delivery_reports" ADD COLUMN "excludeFromBenchmark" BOOLEAN NOT NULL DEFAULT false;
