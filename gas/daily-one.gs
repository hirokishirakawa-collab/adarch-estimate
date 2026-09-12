/**
 * アーチくんの「今日の1件」— 1人1日1件を、OSの中だけで届ける
 *
 * 届け方: アーチくん → 各代表への1対1の「ひとこと」（/dashboard/live）。離席中はベルにも載る。
 * 出さないもの: Google Chatのスペース・メール（2026-09-13 代表判断＝OSの中だけ）
 * 送らない相手: やることが無い人／直近30日に動きが無い人
 *
 * ── セットアップ ──
 * 置き場所は live-digest.gs と同じ「グループサポートbot」のGASプロジェクト。
 *
 * 1. ＋ → スクリプト でファイルを足し、この中身を貼る
 * 2. スクリプトプロパティに CRON_SECRET があるか確認（live-digest.gs と同じもの）
 * 3. dailyOneDryRun() を実行 → 誰に何が届くかだけ実行ログに出る（送らない）
 * 4. dailyOne() を実行 → 実際に届く
 * 5. トリガー作成: 関数=dailyOne / 時間主導型 / 日付ベース / 午前8〜9時
 */

var DAILY_ONE_OS_BASE = "https://adarch-estimate-production.up.railway.app";

function dailyOne() {
  callDailyOne("");
}

function dailyOneDryRun() {
  callDailyOne("?dry=1");
}

function callDailyOne(query) {
  var secret = PropertiesService.getScriptProperties().getProperty("CRON_SECRET");
  if (!secret) {
    Logger.log("❌ CRON_SECRET がスクリプトプロパティに未設定です");
    return;
  }
  var res = UrlFetchApp.fetch(DAILY_ONE_OS_BASE + "/api/cron/daily-one" + query, {
    method: "get",
    headers: { Authorization: "Bearer " + secret },
    muteHttpExceptions: true,
  });
  Logger.log("[今日の1件] " + res.getResponseCode() + " " + res.getContentText().slice(0, 1000));
}
