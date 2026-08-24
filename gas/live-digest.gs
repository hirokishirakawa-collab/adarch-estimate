/**
 * グループの動き 朝まとめ — 1日1回、前日の動きをGoogle Chatへ
 *
 * 流すもの: 受注／商談が動いた件数／アプローチ件数／動いた拠点の順位
 * 流さないもの: 金額・週次共有（ライブボードと同じ線引き）
 * 動きが1件も無かった日は送らない（無風の通知でスペースを埋めない）
 *
 * ── セットアップ ──
 * 置き場所は「グループサポートbot」のGASプロジェクト
 * （Code.gs / Config.gs / CardBuilder.gs / FollowUp.gs が入っているもの）。
 * グループ向けの定期配信を回している場所で、cronを叩く前例もある（triggerPartnerStatusCron）。
 *
 * 1. そのプロジェクトに ＋ → スクリプト でファイルを足し、この中身を貼る
 * 2. プロジェクトの設定 → スクリプトプロパティに CRON_SECRET があるか確認
 *    無ければ Code.gs の triggerPartnerStatusCron 内の値をコピーして追加
 *    あわせてタイムゾーンが「日本標準時 - 東京」かも見る
 * 3. liveDigestDryRun() を実行 → Chatに流さず本文だけ実行ログに出る
 * 4. liveDigest() を実行 → 実際に1通流れる
 * 5. トリガー作成: 関数=liveDigest / 時間主導型 / 日付ベース / 午前8〜9時
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
