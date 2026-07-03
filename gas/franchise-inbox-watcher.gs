/**
 * 加盟パイプライン受信箱ウォッチャー — GAS時間トリガー（30分毎）
 *
 * 2つの自動化を1関数で実行:
 *  A. 窓口リード自動起票: from:info@fc-mado.com の資料請求通知
 *     → OS /api/franchise-leads/intake へ本文をPOST（AIが項目抽出して起票＋Chat通知）
 *  B. TimeRex予約自動検知: from:notifications@timerex.net「日程調整が完了しました」
 *     → OS /api/franchise-leads/booking-signal へ本文をPOST
 *       （リードをMEETING_SCHEDULEDに更新＋Chat祝賀通知。代表自身の予約は自動無視）
 *
 * 二重処理防止: メッセージID単位でScript Propertiesに記録
 *   ※窓口メールは同一スレッドに複数通たまるため、スレッド単位のラベル管理は不可
 * リード本人へは何も送信しない（自動追いかけ禁止の原則）
 *
 * ── セットアップ（group-supportプロジェクトに追加・3分）──
 * 1. このファイルをスクリプトとして追加（CRON_SECRETプロパティは設定済みのはず）
 * 2. トリガー画面から手動作成: 関数=watchFranchiseInbox / 時間主導型 / 分ベース / 30分おき
 * 3. watchFranchiseInbox() を手動実行 → 初回はGmail権限の承認 → ログ確認
 *    ※初回実行時、直近3日の未処理メールがまとめて起票される（起票済み分はOS側で追記に集約）
 */

var OS_BASE = "https://adarch-estimate-production.up.railway.app";
var PROCESSED_PROP = "FRANCHISE_PROCESSED_MSG_IDS";
var PROCESSED_MAX = 400;

function watchFranchiseInbox() {
  var secret = PropertiesService.getScriptProperties().getProperty("CRON_SECRET");
  if (!secret) {
    Logger.log("CRON_SECRET がスクリプトプロパティに未設定です");
    return;
  }
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
        Logger.log("[" + tag + "] " + code + " " + res.getContentText().slice(0, 200));
        if (code < 400) {
          markProcessed_(processed, id); // 失敗分は記録せず次回リトライ
        }
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
