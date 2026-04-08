// ==============================================================
// auto-sales-cron.gs — 自動営業 定期実行スクリプト
// ==============================================================
// GASエディタに貼り付けて使用。
// Script Properties に以下を設定:
//   API_BASE_URL : https://adarch-estimate-production.up.railway.app
//   API_KEY      : GROUP_SUPPORT_API_KEY と同じ値
//
// トリガー設定:
//   checkAutoSalesResponses → 15分おき
//   finalizeNoReply → 毎日 9:00
//   generateWeeklyInsights → 毎週月曜 9:30
//   sendAutoSalesWeeklyReport → 毎週金曜 10:00
// ==============================================================

/**
 * media@adarch.co.jp への返信メールをスキャンし、
 * 自動営業ジョブに反響として紐付ける
 */
function checkAutoSalesResponses() {
  var props = PropertiesService.getScriptProperties();
  var apiBaseUrl = props.getProperty('API_BASE_URL');
  var apiKey = props.getProperty('API_KEY');
  var lastChecked = props.getProperty('AUTO_SALES_LAST_CHECKED') || '';

  // 検索クエリ: media@adarch.co.jp 宛の受信メール（最新24時間）
  var query = 'to:media@adarch.co.jp newer_than:1d -from:media@adarch.co.jp';
  if (lastChecked) {
    query = 'to:media@adarch.co.jp after:' + lastChecked + ' -from:media@adarch.co.jp';
  }

  var threads = GmailApp.search(query, 0, 50);
  var processedCount = 0;

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var from = msg.getFrom();
      var subject = msg.getSubject();
      var snippet = msg.getPlainBody().substring(0, 500);
      var messageId = msg.getId();

      // 自分自身の送信は除外
      if (from.indexOf('media@adarch.co.jp') >= 0) continue;
      if (from.indexOf('adarch.co.jp') >= 0) continue;

      // APIに反響を通知
      try {
        var payload = {
          from: from,
          subject: subject,
          snippet: snippet,
          messageId: messageId,
        };

        var response = UrlFetchApp.fetch(apiBaseUrl + '/api/auto-sales/check-responses', {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-api-key': apiKey },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });

        var code = response.getResponseCode();
        if (code === 200) {
          var body = JSON.parse(response.getContentText());
          if (body.matched) {
            processedCount++;
            Logger.log('反響マッチ: ' + from + ' → ' + body.companyName);
          }
        }
      } catch (e) {
        Logger.log('API呼び出しエラー: ' + e.message);
      }
    }
  }

  // 最終チェック日時を更新
  var now = new Date();
  var dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd');
  props.setProperty('AUTO_SALES_LAST_CHECKED', dateStr);

  Logger.log('反響チェック完了: ' + processedCount + '件マッチ / ' + threads.length + 'スレッド処理');
}

/**
 * 週次レポートを取得してCEOにメール送信
 */
function sendAutoSalesWeeklyReport() {
  var props = PropertiesService.getScriptProperties();
  var apiBaseUrl = props.getProperty('API_BASE_URL');
  var apiKey = props.getProperty('API_KEY');

  try {
    var response = UrlFetchApp.fetch(apiBaseUrl + '/api/auto-sales/weekly-report', {
      method: 'get',
      headers: { 'x-api-key': apiKey },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('週次レポートAPI エラー: ' + response.getResponseCode());
      return;
    }

    var data = JSON.parse(response.getContentText());
    var report = data.report;

    if (!report || report.length === 0) {
      Logger.log('週次レポート: データなし');
      return;
    }

    // メール本文を構築
    var html = '<h2>自動営業 週次レポート</h2>';
    html += '<p>' + data.period.start + ' 〜 ' + data.period.end + '</p>';
    html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; font-size:14px;">';
    html += '<tr style="background:#1a237e; color:white;">';
    html += '<th>拠点</th><th>送信</th><th>成功</th><th>失敗</th><th>反響</th><th>反響率</th>';
    html += '</tr>';

    var totalSent = 0, totalCompleted = 0, totalFailed = 0, totalResponses = 0;

    for (var i = 0; i < report.length; i++) {
      var r = report[i];
      totalSent += r.sent;
      totalCompleted += r.completed;
      totalFailed += r.failed;
      totalResponses += r.responses;

      html += '<tr>';
      html += '<td><strong>' + r.branchName + '</strong></td>';
      html += '<td style="text-align:right">' + r.sent + '</td>';
      html += '<td style="text-align:right">' + r.completed + '</td>';
      html += '<td style="text-align:right">' + r.failed + '</td>';
      html += '<td style="text-align:right">' + r.responses + '</td>';
      html += '<td style="text-align:right"><strong>' + r.responseRate + '</strong></td>';
      html += '</tr>';
    }

    // 合計行
    var totalRate = totalCompleted > 0 ? (totalResponses / totalCompleted * 100).toFixed(1) + '%' : '0%';
    html += '<tr style="background:#f5f5f5; font-weight:bold;">';
    html += '<td>合計</td>';
    html += '<td style="text-align:right">' + totalSent + '</td>';
    html += '<td style="text-align:right">' + totalCompleted + '</td>';
    html += '<td style="text-align:right">' + totalFailed + '</td>';
    html += '<td style="text-align:right">' + totalResponses + '</td>';
    html += '<td style="text-align:right">' + totalRate + '</td>';
    html += '</tr></table>';

    // CEO宛にメール送信
    GmailApp.sendEmail(
      'hiroki.shirakawa@adarch.co.jp',
      '【自動営業】週次レポート ' + data.period.start + '〜' + data.period.end,
      '',
      { htmlBody: html, name: 'Ad Arch 自動営業システム' }
    );

    Logger.log('週次レポート送信完了');
  } catch (e) {
    Logger.log('週次レポートエラー: ' + e.message);
  }
}

/**
 * 未返信確定バッチ — 送信3日経過+返信なしのジョブを確定し、
 * アプローチ事例集に自動投稿する
 * トリガー: 毎日 9:00
 */
function finalizeNoReply() {
  var props = PropertiesService.getScriptProperties();
  var apiBaseUrl = props.getProperty('API_BASE_URL');
  var apiKey = props.getProperty('API_KEY');

  try {
    var response = UrlFetchApp.fetch(apiBaseUrl + '/api/auto-sales/finalize-no-reply', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey },
      payload: '{}',
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() === 200) {
      var body = JSON.parse(response.getContentText());
      Logger.log('未返信確定: ' + body.confirmed + '件確定, ' + body.approachesCreated + '件アプローチ投稿');
    } else {
      Logger.log('未返信確定API エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('未返信確定エラー: ' + e.message);
  }
}

/**
 * 週次インサイト自動生成 — 過去7日間の送信結果を
 * 業種別に集計してsales-insightsに自動投稿する
 * トリガー: 毎週月曜 9:30
 */
function generateWeeklyInsights() {
  var props = PropertiesService.getScriptProperties();
  var apiBaseUrl = props.getProperty('API_BASE_URL');
  var apiKey = props.getProperty('API_KEY');

  try {
    var response = UrlFetchApp.fetch(apiBaseUrl + '/api/auto-sales/generate-insights', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey },
      payload: '{}',
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() === 200) {
      var body = JSON.parse(response.getContentText());
      Logger.log('週次インサイト生成: ' + body.created + '件作成 (' + body.period + ')');
    } else {
      Logger.log('週次インサイトAPI エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('週次インサイトエラー: ' + e.message);
  }
}

/**
 * テスト用: 反響チェックを手動実行
 */
function testCheckResponses() {
  checkAutoSalesResponses();
}

/**
 * テスト用: 週次レポートを手動実行
 */
function testWeeklyReport() {
  sendAutoSalesWeeklyReport();
}

/**
 * テスト用: 未返信確定を手動実行
 */
function testFinalizeNoReply() {
  finalizeNoReply();
}

/**
 * テスト用: 週次インサイト生成を手動実行
 */
function testGenerateInsights() {
  generateWeeklyInsights();
}
