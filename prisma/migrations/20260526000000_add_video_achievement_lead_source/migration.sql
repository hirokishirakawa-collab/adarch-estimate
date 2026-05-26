-- 競合実績由来のリードを source で識別できるようにする
-- 既存の startAttackFromAchievement は "MANUAL" を使っていたが、手動登録と区別できないため専用値を追加

ALTER TYPE "LeadSource" ADD VALUE 'VIDEO_ACHIEVEMENT';
