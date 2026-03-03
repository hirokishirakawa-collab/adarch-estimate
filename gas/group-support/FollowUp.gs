// ==============================================================
// FollowUp.gs — 声かけ・CEOダイジェスト
// ==============================================================

/**
 * 未回答社への声かけを送信
 * @param {number} round - 1（火曜）or 2（水曜）
 */
function followUpUnsubmitted(round) {
  var statusData = getSubmissionStatus();
  var notSubmitted = statusData.notSubmitted || [];

  if (notSubmitted.length === 0) {
    Logger.log('全社共有済み — 声かけスキップ');
    return;
  }

  notSubmitted.forEach(function (company) {
    var message = buildFollowUpMessage_(round, company.name);

    // スペースにメッセージ送信
    try {
      Chat.Spaces.Messages.create(
        { text: message },
        company.chatSpaceId
      );
    } catch (e) {
      Logger.log(
        '声かけ送信失敗 (' + company.chatSpaceId + '): ' + e.message
      );
    }

    // コンタクト履歴に記録
    postWebhook('/api/group-support/webhook/contact', {
      chatSpaceId: company.chatSpaceId,
      type: 'FOLLOW_UP',
      content: (round === 1 ? '1回目' : '2回目') + '声かけ送信',
      actorName: 'サポート事務局Bot',
    });
  });

  Logger.log(
    round + '回目声かけ完了: ' + notSubmitted.length + '社'
  );
}

/**
 * 声かけメッセージを構築（トーン規則遵守）
 * NG: 報告、催促、未提出、遅れています、管理、リマインド
 * OK: 共有、シェア、声かけ、フォロー
 */
function buildFollowUpMessage_(round, companyName) {
  if (round === 1) {
    // 火曜: 気軽なトーン
    return (
      'こんにちは！サポート事務局です 😊\n\n' +
      '今週の共有がまだのようでしたので、お声がけしました。\n' +
      '1分ほどで完了しますので、お手すきの際にぜひ！\n\n' +
      '上のカードの「今週のシェアを始める」からどうぞ 👆'
    );
  }

  // 水曜: トーン変更、相談OK案内
  return (
    'こんにちは！サポート事務局です。\n\n' +
    '今週の共有、いつでもお待ちしています 🙌\n' +
    'もし何かお困りごとがあれば、共有フォームの中でも、\n' +
    'このスペースでの直接メッセージでも大丈夫です。\n\n' +
    'お気軽にどうぞ！'
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
}
