-- LeadStatus enum に CRAWLED を追加（TVCM/動画PRクロール時の自動保存用）

ALTER TYPE "LeadStatus" ADD VALUE 'CRAWLED';
