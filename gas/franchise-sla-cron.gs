/**
 * 加盟パイプラインSLA監視 — GAS時間トリガー
 *
 * OSの /api/cron/franchise-sla を1日2回（JST 9時・17時）叩き、
 * SLA超過があればCEO通知スペースにアラートが飛ぶ（通知はOS側が送信）。
 *
 * ── セットアップ手順（5分）──
 * 1. script.google.com で新規プロジェクト作成（または既存 group-support プロジェクトに追加）
 * 2. このファイルの内容を貼り付け
 * 3. プロジェクトの設定 → スクリプト プロパティ に CRON_SECRET を追加
 *    （値は Railway の環境変数 CRON_SECRET と同じもの）
 * 4. setupFranchiseSlaTriggers() を一度実行 → トリガーが2本作成される
 * 5. checkFranchiseSla() を手動実行して Logger に {"checked":N,"alerted":N} が出れば完了
 */

var FRANCHISE_SLA_URL =
  "https://adarch-estimate-production.up.railway.app/api/cron/franchise-sla";

function checkFranchiseSla() {
  var secret = PropertiesService.getScriptProperties().getProperty("CRON_SECRET");
  if (!secret) {
    Logger.log("CRON_SECRET がスクリプトプロパティに未設定です");
    return;
  }
  var res = UrlFetchApp.fetch(FRANCHISE_SLA_URL, {
    method: "get",
    headers: { Authorization: "Bearer " + secret },
    muteHttpExceptions: true,
  });
  Logger.log("franchise-sla: " + res.getResponseCode() + " " + res.getContentText());
}

/** 初回のみ実行: JST 9時・17時の時間トリガーを作成（既存の同名トリガーは張り替え） */
function setupFranchiseSlaTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "checkFranchiseSla") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("checkFranchiseSla").timeBased().everyDays(1).atHour(9).create();
  ScriptApp.newTrigger("checkFranchiseSla").timeBased().everyDays(1).atHour(17).create();
  Logger.log("トリガー2本（9時・17時）を作成しました");
}
