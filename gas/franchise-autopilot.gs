/**
 * 加盟パイプライン自動操縦（オールインワン版）— これ1本で全部動く
 *
 * 30分毎に以下を実行:
 *  1. SLA監視     : 返信遅れ等をChatアラート（同一ステージ1回のみ通知）
 *  2. 契約期限監視 : 加盟契約の満了150/120/97日前をChatアラート
 *  3. 窓口メール   : 資料請求通知を検知→OSへ自動起票＋Chat通知
 *  4. TimeRex予約 : 予約確定メールを検知→リードを面談予定に＋🎉Chat通知（TimeRexは2026-09-06解約・互換のため残置）
 *  5. Googleカレンダー予約 : 予約スケジュール「Ad Archグループ個別説明会」に入った予約を検知→同上
 *     （https://calendar.app.google/9FBqdgrn54fEp9xj9 ／ 2026-09-11 TimeRex 404 の後継）
 *
 * リード本人へは何も送信しない（自動追いかけ禁止の原則）
 * 旧 franchise-sla-cron.gs / franchise-inbox-watcher.gs はこのファイルに統合済み（2026-07-03）
 *
 * ── セットアップ（専用の新規プロジェクトで）──
 * 1. このファイルを丸ごと貼り付け
 * 2. プロジェクトの設定 → タイムゾーン=東京 を確認、
 *    スクリプトプロパティに CRON_SECRET を追加（値はgroup-supportプロジェクトと同じ）
 * 3. franchiseAutopilot() を一度実行 → Gmail・カレンダーの承認（2026-09-11 CalendarApp追加＝再承認が1回要る）
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
  // 5. Googleカレンダー予約（予約スケジュール）
  processCalendarBookings_(secret, processed);
  saveProcessed_(processed);
}

// ── Googleカレンダー予約検知 ─────────────────────
// 予約スケジュール経由の予定は、既定カレンダーに「ゲスト＝予約者」付きで作られる。
// 予定タイトルに BOOKING_TITLE を含み、自分以外のゲストが居るものを予約とみなし、
// TimeRexメールと同じ書式（名前／メールアドレス／日時）に組み立てて booking-signal へ渡す。
var BOOKING_TITLE = "個別説明会";
var BOOKING_SELF = ["hiroki.shirakawa@adarch.co.jp"];

function processCalendarBookings_(secret, processed) {
  var now = new Date();
  var until = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
  var events;
  try {
    events = CalendarApp.getDefaultCalendar().getEvents(now, until);
  } catch (e) {
    Logger.log("[予約検知/カレンダー] error: " + e);
    return;
  }
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var title = ev.getTitle() || "";
    var desc = ev.getDescription() || "";
    // 予約スケジュール経由の予定＝タイトルに説明会名、または説明文に予約ページの痕跡
    if (title.indexOf(BOOKING_TITLE) < 0 && desc.indexOf("appointments/schedules") < 0 && desc.indexOf("calendar.app.google") < 0) continue;
    var key = "cal:" + ev.getId();
    if (processed.ids[key]) continue;
    var guests = ev.getGuestList();
    var guest = null;
    for (var g = 0; g < guests.length; g++) {
      var em = (guests[g].getEmail() || "").toLowerCase();
      if (em && BOOKING_SELF.indexOf(em) < 0) { guest = guests[g]; break; }
    }
    if (!guest) { markProcessed_(processed, key); continue; }
    var name = guest.getName() || title.replace(BOOKING_TITLE, "").replace(/[:：\-–—()（）]/g, " ").trim() || "不明";
    var dt = Utilities.formatDate(ev.getStartTime(), "Asia/Tokyo", "yyyy年M月d日 HH:mm") +
      " - " + Utilities.formatDate(ev.getEndTime(), "Asia/Tokyo", "HH:mm") + "（Asia/Tokyo）";
    var raw = "件名: " + title + "\n日時：" + dt + "\n名前：" + name + "\nメールアドレス：" + guest.getEmail() + "\n経路：Googleカレンダー予約";
    try {
      var res = UrlFetchApp.fetch(OS_BASE + "/api/franchise-leads/booking-signal", {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + secret },
        payload: JSON.stringify({ raw: raw }),
        muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      Logger.log("[予約検知/カレンダー] " + code + " " + res.getContentText().slice(0, 150));
      if (code < 400) markProcessed_(processed, key);
    } catch (e) {
      Logger.log("[予約検知/カレンダー] error: " + e);
    }
  }
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
