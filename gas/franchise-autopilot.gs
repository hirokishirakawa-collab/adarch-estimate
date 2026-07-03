/**
 * 加盟パイプライン自動操縦（オールインワン版）— これ1本で全部動く
 *
 * 30分毎に以下を実行:
 *  1. SLA監視     : 返信遅れ等をChatアラート（同一ステージ1回のみ通知）
 *  2. 契約期限監視 : 加盟契約の満了150/120/97日前をChatアラート
 *  3. 窓口メール   : 資料請求通知を検知→OSへ自動起票＋Chat通知
 *  4. TimeRex予約 : 予約確定メールを検知→リードを面談予定に＋🎉Chat通知
 *
 * リード本人へは何も送信しない（自動追いかけ禁止の原則）
 * 旧 franchise-sla-cron.gs / franchise-inbox-watcher.gs はこのファイルに統合済み（2026-07-03）
 *
 * ── セットアップ（専用の新規プロジェクトで）──
 * 1. このファイルを丸ごと貼り付け
 * 2. プロジェクトの設定 → タイムゾーン=東京 を確認、
 *    スクリプトプロパティに CRON_SECRET を追加（値はgroup-supportプロジェクトと同じ）
 * 3. franchiseAutopilot() を一度実行 → Gmail等の承認
 * 4. トリガー作成: 関数=franchiseAutopilot / 時間主導型 / 分ベース / 30分おき
 * ※ group-supportプロジェクト側の旧 checkFranchiseSla トリガー（9時/17時）は削除する
 */

var OS_BASE = "https://adarch-estimate-production.up.railway.app";
var PROCESSED_PROP = "FRANCHISE_PROCESSED_MSG_IDS";
var PROCESSED_MAX = 400;

function franchiseAutopilot() {
  var secret = PropertiesService.getScriptProperties().getProperty("CRON_SECRET");
  if (!secret) {
    Logger.log("❌ CRON_SECRET がスクリプトプロパティに未設定です");
    return;
  }
  var getOpts = {
    method: "get",
    headers: { Authorization: "Bearer " + secret },
    muteHttpExceptions: true,
  };

  // 1. SLA監視
  var r1 = UrlFetchApp.fetch(OS_BASE + "/api/cron/franchise-sla", getOpts);
  Logger.log("[SLA] " + r1.getResponseCode() + " " + r1.getContentText().slice(0, 150));

  // 2. 契約期限監視
  var r2 = UrlFetchApp.fetch(OS_BASE + "/api/cron/contract-renewal", getOpts);
  Logger.log("[契約期限] " + r2.getResponseCode() + " " + r2.getContentText().slice(0, 150));

  // 3-4. 受信箱ウォッチ（窓口・TimeRex）
  var processed = loadProcessed_();
  processMatches_(
    'from:info@fc-mado.com subject:(資料請求通知) newer_than:3d',
    "/api/franchise-leads/intake",
    function (body) { return { text: body }; },
    secret, processed, "窓口起票"
  );
  processMatches_(
    'from:notifications@timerex.net subject:(日程調整が完了しました) newer_than:3d',
    "/api/franchise-leads/booking-signal",
    function (body) { return { raw: body }; },
    secret, processed, "予約検知"
  );
  saveProcessed_(processed);
}

// ── 内部関数 ──────────────────────────────────

function processMatches_(query, path, buildPayload, secret, processed, tag) {
  var threads = GmailApp.search(query, 0, 20);
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var id = messages[j].getId();
      if (processed.ids[id]) continue;
      var body = messages[j].getPlainBody();
      if (!body || body.length < 20) { markProcessed_(processed, id); continue; }
      try {
        var res = UrlFetchApp.fetch(OS_BASE + path, {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: "Bearer " + secret },
          payload: JSON.stringify(buildPayload(body)),
          muteHttpExceptions: true,
        });
        var code = res.getResponseCode();
        Logger.log("[" + tag + "] " + code + " " + res.getContentText().slice(0, 150));
        if (code < 400) markProcessed_(processed, id); // 失敗分は次回リトライ
      } catch (e) {
        Logger.log("[" + tag + "] error: " + e);
      }
    }
  }
}

function loadProcessed_() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROCESSED_PROP);
  var order = raw ? JSON.parse(raw) : [];
  var ids = {};
  for (var i = 0; i < order.length; i++) ids[order[i]] = true;
  return { order: order, ids: ids };
}

function markProcessed_(processed, id) {
  if (processed.ids[id]) return;
  processed.ids[id] = true;
  processed.order.push(id);
}

function saveProcessed_(processed) {
  var order = processed.order;
  if (order.length > PROCESSED_MAX) order = order.slice(order.length - PROCESSED_MAX);
  PropertiesService.getScriptProperties().setProperty(PROCESSED_PROP, JSON.stringify(order));
}
