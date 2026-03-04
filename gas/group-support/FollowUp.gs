// ==============================================================
// FollowUp.gs — 声かけ・CEOダイジェスト（Webhook版）
// ==============================================================

/**
 * 未回答社への声かけを送信（Webhook版）
 * @param {number} round - 1（火曜）or 2（水曜）
 */
function followUpUnsubmitted(round) {
  var statusData = getSubmissionStatus();
  var notSubmitted = statusData.notSubmitted || [];

  if (notSubmitted.length === 0) {
    Logger.log('全社共有済み — 声かけスキップ');
    return;
  }

  var webhookMap = getWebhookMap_();
  var baseUrl = getConfig().API_BASE_URL + '/group-support/submit';

  notSubmitted.forEach(function (company) {
    var webhookUrl = webhookMap[company.chatSpaceId];
    if (!webhookUrl) {
      Logger.log('Webhook未設定: ' + company.chatSpaceId);
      return;
    }

    var submitUrl = baseUrl + '?space=' + encodeURIComponent(company.chatSpaceId);
    var message = buildFollowUpMessage_(round, company.name, submitUrl);

    // Webhook でメッセージ送信
    try {
      UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ text: message }),
        muteHttpExceptions: true,
      });
    } catch (e) {
      Logger.log('声かけ送信失敗 (' + company.chatSpaceId + '): ' + e.message);
    }

    // コンタクト履歴に記録
    postWebhook('/api/group-support/webhook/contact', {
      chatSpaceId: company.chatSpaceId,
      type: 'FOLLOW_UP',
      content: (round === 1 ? '1回目' : '2回目') + '声かけ送信',
      actorName: 'サポート事務局Bot',
    });
  });

  Logger.log(round + '回目声かけ完了: ' + notSubmitted.length + '社');
}

/**
 * WEBHOOK_MAP から chatSpaceId → webhook URL のマッピングを取得
 */
function getWebhookMap_() {
  var raw = PropertiesService.getScriptProperties().getProperty('WEBHOOK_MAP') || '{}';
  return JSON.parse(raw);
}

/**
 * 声かけメッセージを構築（トーン規則遵守）
 * NG: 報告、催促、未提出、遅れています、管理、リマインド
 * OK: 共有、シェア、声かけ、フォロー
 */
function buildFollowUpMessage_(round, companyName, submitUrl) {
  if (round === 1) {
    // 火曜: 気軽なトーン
    return (
      'こんにちは！サポート事務局です 😊\n\n' +
      '今週の共有がまだのようでしたので、お声がけしました。\n' +
      '1分ほどで完了しますので、お手すきの際にぜひ！\n\n' +
      '👉 ' + submitUrl
    );
  }

  // 水曜: トーン変更、相談OK案内
  return (
    'こんにちは！サポート事務局です。\n\n' +
    '今週の共有、いつでもお待ちしています 🙌\n' +
    'もし何かお困りごとがあれば、共有フォームの中でも、\n' +
    'このスペースでの直接メッセージでも大丈夫です。\n\n' +
    '👉 ' + submitUrl
  );
}

/**
 * 木曜 CEOダイジェスト — Gmailで送信
 */
function sendCeoDigest() {
  var statusData = getSubmissionStatus();

  var ceoEmail =
    PropertiesService.getScriptProperties().getProperty('CEO_EMAIL') ||
    '';
  if (!ceoEmail) {
    Logger.log('CEO_EMAIL が未設定です');
    return;
  }

  var submitted = statusData.submitted || [];
  var notSubmitted = statusData.notSubmitted || [];
  var total = statusData.total || 0;
  var weekId = statusData.weekId || '';

  // メール本文を構築
  var body = '';
  body += '【' + weekId + '】グループサポート週次サマリー\n\n';
  body +=
    '共有済み: ' +
    submitted.length +
    '社 / ' +
    total +
    '社\n';
  body += '未共有: ' + notSubmitted.length + '社\n\n';

  if (submitted.length > 0) {
    body += '--- 共有済み ---\n';
    submitted.forEach(function (c) {
      body += '  ✅ ' + c.name + '\n';
    });
    body += '\n';
  }

  if (notSubmitted.length > 0) {
    body += '--- 未共有 ---\n';
    notSubmitted.forEach(function (c) {
      body += '  ⬜ ' + c.name + '\n';
    });
    body += '\n';
  }

  body += '詳細はダッシュボードをご確認ください。\n';
  body +=
    PropertiesService.getScriptProperties().getProperty('API_BASE_URL') +
    '/dashboard/group-support';

  GmailApp.sendEmail(
    ceoEmail,
    '【グループサポート】' + weekId + ' 週次サマリー',
    body
  );

  Logger.log('CEOダイジェスト送信完了: ' + ceoEmail);

  // AI週報メールをトリガー
  triggerWeeklyReport_();
}

/**
 * AI週報生成APIを呼び出す
 */
function triggerWeeklyReport_() {
  var config = getConfig();
  var url = config.API_BASE_URL + '/api/cron/group-support-report';

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'x-api-key': config.API_KEY,
      },
      muteHttpExceptions: true,
    });
    var code = response.getResponseCode();
    Logger.log('AI週報トリガー: ' + code + ' ' + response.getContentText());
  } catch (e) {
    Logger.log('AI週報トリガー失敗: ' + e.message);
  }
}
