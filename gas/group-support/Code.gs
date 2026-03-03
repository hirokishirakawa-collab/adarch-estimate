// ==============================================================
// Code.gs — エントリポイント
// ==============================================================

/**
 * Google Chat カードのボタンクリックハンドラ
 */
function onCardClick(event) {
  var action = event.common && event.common.invokedFunction;

  if (action === 'openWeeklyDialog') {
    return buildWeeklyDialog();
  }

  if (action === 'submitWeekly') {
    return handleWeeklySubmission(event);
  }

  return { text: '不明なアクションです' };
}

/**
 * 週次共有の回答を受け取り、webhook へ送信
 */
function handleWeeklySubmission(event) {
  var inputs = event.common.formInputs;
  var spaceId = event.space && event.space.name;

  var payload = {
    chatSpaceId: spaceId,
    q1: inputs.q1.stringInputs.value[0],
    q2: inputs.q2.stringInputs.value[0],
    q3: inputs.q3.stringInputs.value[0],
    q4: inputs.q4.stringInputs.value[0],
    q5: inputs.q5.stringInputs.value[0],
  };

  var result = postWebhook('/api/group-support/webhook', payload);

  if (result.code === 200) {
    return buildThankYouCard(result.body.companyName);
  }

  return {
    text: '送信時にエラーが発生しました。しばらくしてからもう一度お試しください。',
  };
}

// ==============================================================
// トリガー関数（時間主導型トリガーで設定）
// ==============================================================

/**
 * 月曜 9:00 — 週次カード配信
 */
function triggerMondayCard() {
  var status = getSubmissionStatus();
  // アクティブな全スペースにカードを配信
  var spaces = getAllActiveSpaces_();
  spaces.forEach(function (spaceId) {
    sendCardToSpace_(spaceId, buildMondayCard());
  });
  Logger.log('月曜カード配信完了: ' + spaces.length + '社');
}

/**
 * 火曜 9:00 — 1回目声かけ（未回答社のみ）
 */
function triggerTuesdayFollowUp() {
  followUpUnsubmitted(1);
}

/**
 * 水曜 9:00 — 2回目声かけ（未回答社のみ）
 */
function triggerWednesdayFollowUp() {
  followUpUnsubmitted(2);
}

/**
 * 木曜 9:00 — CEOダイジェスト（Gmailで送信）
 */
function triggerThursdayCeoDigest() {
  sendCeoDigest();
}

// ==============================================================
// 内部ヘルパー
// ==============================================================

/**
 * アクティブな全スペースIDを取得
 * ※ Script Properties に SPACE_IDS をカンマ区切りで設定
 */
function getAllActiveSpaces_() {
  var raw =
    PropertiesService.getScriptProperties().getProperty('SPACE_IDS') || '';
  return raw
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

/**
 * 指定スペースにカードを送信
 */
function sendCardToSpace_(spaceId, card) {
  try {
    Chat.Spaces.Messages.create(
      { cardsV2: [{ cardId: 'weekly-card', card: card }] },
      spaceId
    );
  } catch (e) {
    Logger.log('送信失敗 (' + spaceId + '): ' + e.message);
  }
}
