-- 媒体請求で「どの媒体か」を持たせる。
-- 取引媒体によって媒体側へ支払う額が変わり、本部手数料の条件も変わるため、
-- 本部が許可の段階で手数料を打ち込むときの判断材料になる。
--
-- 追加のみ。既存行は NULL。
ALTER TABLE "invoice_requests" ADD COLUMN IF NOT EXISTS "mediaName" TEXT;
