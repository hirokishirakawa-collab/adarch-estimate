-- 支払明細の項目別 都道府県: 明細行ごとに「どの県の売上か」を持たせる。
-- 従来は親 payment_statements.branchLabel に明細1枚あたり1県だけだった。
-- nullable・追加のみ（既存行・既存アプリに影響なし）。値は都道府県フル名（例: 山口県）。

ALTER TABLE "payment_statement_items"
  ADD COLUMN "prefecture" TEXT;
