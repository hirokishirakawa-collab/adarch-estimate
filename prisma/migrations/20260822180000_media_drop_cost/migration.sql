-- 媒体行から媒体費実費を落とす。
-- 申請側が入れるのは「媒体名：クライアント請求額」までにして入力事故を防ぐ。
-- 媒体へ支払う実費と取り分は、本部が計算して提示する。
--
-- 媒体請求の実データはまだ0件のため、落として問題ない。
ALTER TABLE "invoice_request_medias" DROP COLUMN IF EXISTS "costExclTax";
