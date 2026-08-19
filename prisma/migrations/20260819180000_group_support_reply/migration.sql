-- グループサポート: 週次共有への返信（本部⇄加盟代表）
-- 既存の enum に値を追加するだけ。テーブル追加・既存データの書き換えはない。

-- 加盟代表からの返信を contact_histories に記録するための型
ALTER TYPE "ContactType" ADD VALUE IF NOT EXISTS 'PARTNER_REPLY';

-- 返信が届いたことを知らせる通知の型
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROUP_REPLY';
