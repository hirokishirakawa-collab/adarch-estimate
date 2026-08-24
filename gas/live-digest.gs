/**
 * グループの動き 朝まとめ — 1日1回、前日の動きをGoogle Chatへ
 *
 * 流すもの: 受注／商談が動いた件数／アプローチ件数／動いた拠点の順位
 * 流さないもの: 金額・週次共有（ライブボードと同じ線引き）
 * 動きが1件も無かった日は送らない（無風の通知でスペースを埋めない）
 *
 * ── セットアップ ──
 * 1. 新規GASプロジェクト（またはfranchise-autopilotと同じプロジェクト）にこのファイルを貼る
 * 2. スクリプトプロパティに CRON_SECRET を追加（他のcronと同じ値）
 * 3. liveDigest() を一度手で実行して動作確認（Logger に送信結果が出る）
 * 4. トリガー作成: 関数=liveDigest / 時間主導型 / 日付ベース / 午前8〜9時
 *
 * 送信先は案件進捗スペース（商談・リード・アプローチ事例が既に流れている場所）。
 * 変えるときは Railway の環境変数 DEAL_CHAT_SPACE_ID を差し替える。
 */

var LIVE_OS_BASE = "https://adarch-estimate-production.up.railway.app";

function liveDigest() {
  var secret = PropertiesService.getScriptProperties().getProperty("CRON_SECRET");
  if (!secret) {
    Logger.log("❌ CRON_SECRET がスクリプトプロパティに未設定です");
    return;
  }
  var res = UrlFetchApp.fetch(LIVE_OS_BASE + "/api/cron/live-digest", {
    method: "get",
    headers: { Authorization: "Bearer " + secret },
    muteHttpExceptions: true,
  });
  Logger.log("[朝まとめ] " + res.getResponseCode() + " " + res.getContentText().slice(0, 300));
}

/** 送らずに本文だけ確認したいとき（Chatには一切流れない） */
function liveDigestDryRun() {
  var secret = PropertiesService.getScriptProperties().getProperty("CRON_SECRET");
  var res = UrlFetchApp.fetch(LIVE_OS_BASE + "/api/cron/live-digest?dry=1", {
    method: "get",
    headers: { Authorization: "Bearer " + secret },
    muteHttpExceptions: true,
  });
  Logger.log(res.getContentText());
}
