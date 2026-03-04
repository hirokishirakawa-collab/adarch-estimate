// ==============================================================
// Code.gs — エントリポイント（Webhook版）
// ==============================================================

// ==============================================================
// トリガー関数（時間主導型トリガーで設定）
// ==============================================================

/**
 * 月曜 9:00 — 週次カード配信（全社）
 */
function triggerMondayCard() {
  var webhooks = getWebhookUrls_();
  var baseUrl = getConfig().API_BASE_URL + '/group-support/submit';

  webhooks.forEach(function (webhookUrl) {
    var spaceId = extractSpaceId_(webhookUrl);
    var submitUrl = baseUrl + '?space=' + encodeURIComponent(spaceId);
    var card = buildMondayCard(submitUrl);
    var payload = JSON.stringify({ cardsV2: [{ cardId: 'weekly-card', card: card }] });

    try {
      UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true,
      });
    } catch (e) {
      Logger.log('送信失敗: ' + e.message);
    }
  });

  Logger.log('月曜カード配信完了: ' + webhooks.length + '社');
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
 * WEBHOOK_URLS からURL一覧を取得
 */
function getWebhookUrls_() {
  var raw = PropertiesService.getScriptProperties().getProperty('WEBHOOK_URLS') || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

/**
 * Webhook URL から spaceId を抽出
 * 例: "https://...spaces/AAQA1ONKAvc/messages..." → "spaces/AAQA1ONKAvc"
 */
function extractSpaceId_(webhookUrl) {
  var match = webhookUrl.match(/spaces\/([^/]+)/);
  return match ? 'spaces/' + match[1] : '';
}

// ==============================================================
// テスト用
// ==============================================================

function testConnection() {
  var result = getSubmissionStatus();
  Logger.log(JSON.stringify(result, null, 2));
}

function testCeoDigest() {
  sendCeoDigest();
}

function testSendCard() {
  triggerMondayCard();
}

/**
 * Script Properties を再設定（setupWebhookProperties）
 * 一度実行済みのため通常は不要
 */
function setupWebhookProperties() {
  var urls = [
    "https://chat.googleapis.com/v1/spaces/AAQA1ONKAvc/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=IyULvaLMxRIWfve6Pq5_jBYNEENMgrdEg-jqQ-x0t_A",
    "https://chat.googleapis.com/v1/spaces/AAQAtLNqdIc/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=7w7trOypKeQaYFup96XO5GL3tCpduHxLR8aH9RGbQE0",
    "https://chat.googleapis.com/v1/spaces/AAQAZXqimA4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=4Y21x9AWKkkjt5ZvxA_Kigab7cBqfi2FY8TwbPtIQQ4",
    "https://chat.googleapis.com/v1/spaces/AAQA-qXB8rI/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=lrJEV3XZq-0uKMzlkOVGyY0W9AFn2yJDL7d3B61D7TI",
    "https://chat.googleapis.com/v1/spaces/AAQALAC7WwY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=yuqXz1ZMKTzskxzpaWthucEAVPVPis9LbeR-suBghG8",
    "https://chat.googleapis.com/v1/spaces/AAQA5DWfLoE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=GswTHY28niSemwLsKN_Yojb_vVAGLqm3sXIldbXDE-s",
    "https://chat.googleapis.com/v1/spaces/AAQAglZXyhE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=zKntunJY-Yn6g5WvdnWW99pO-z_u54Hw3MCbON1nWPY",
    "https://chat.googleapis.com/v1/spaces/AAQAAUnoJwE/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=C6MQKiOb3xQDwlXe45-XJ54iPrPcv8kr5L1xbaf5JiA",
    "https://chat.googleapis.com/v1/spaces/AAQAWNECvr8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=Ow-ysSHiTYuWimVskA3uzFeHEzDonadnDcD-YXMky74",
    "https://chat.googleapis.com/v1/spaces/AAQAkbYR4II/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mDCX2UzEhXqqTUVs4kZ1qMfHgZyTtQjnGeo38Q6_01k",
    "https://chat.googleapis.com/v1/spaces/AAQAT2_JOrs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=hM_nk1o2F2pYx-j55bgiiVo5tNCusgfVVpko-mFR_ow",
    "https://chat.googleapis.com/v1/spaces/AAQAn5FvUIA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=QenZD9hclXTAGpSeM53iR3qhCf6bqIGFAu2XNCDKyXk",
    "https://chat.googleapis.com/v1/spaces/AAQAKs7kuos/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mcfjQqVhD0DDZa7PCRbS4lzMLQcQzP-sBggsfeoyFYk",
    "https://chat.googleapis.com/v1/spaces/AAQA5h9sJMA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=AtITBqJjWdQozMXLKZfoCDZH5uoqvpONNbsx2qTfN-I",
    "https://chat.googleapis.com/v1/spaces/AAQAh8Wku14/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=yMdEJ_tVU09DPDAwn4QFsUKC_gh4u-Sx_H4bi73W_ho",
    "https://chat.googleapis.com/v1/spaces/AAQAsGlKn5c/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=aDzEeeujsGbo7_rh3xCc7jck1kc1_r1R4HF7ByjkBi8",
    "https://chat.googleapis.com/v1/spaces/AAQAAUMlEc4/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mvY69atxkeWdAqyPx6voR8jJqDVdIMI5y8dgjJMIAw4",
    "https://chat.googleapis.com/v1/spaces/AAQAxtfQtSs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=WxTDMxbb6zzxfGIGjVQ_tPLP9ARXOZFPdJslB07FqHM",
    "https://chat.googleapis.com/v1/spaces/AAQARP8u-EQ/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=MWjswOf47E1I1-u3oSt62iM71PPFjInyspxD51a6YIs",
    "https://chat.googleapis.com/v1/spaces/AAQAR7L5Y0k/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=CYgBJxe_ycUzN43ZTPVfG-GEQQsHjd3tCGaYmsnXMZ0",
    "https://chat.googleapis.com/v1/spaces/AAQAbXme2Us/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=cXNW9zxwUR9N7jCw6SlAVXzt2U3iB3-G28PXhgsXWVQ",
    "https://chat.googleapis.com/v1/spaces/AAQA3TuKvwk/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=IvfkkOscerzcXBSKL0whwIsQ7MypeAV-wcTu495kU48",
    "https://chat.googleapis.com/v1/spaces/AAQAQiXsCUw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=FXCVkmbKf383WQ1nna3qC-_LCf6Q6xmFarGdiJXs5ks",
    "https://chat.googleapis.com/v1/spaces/AAQAoR3gb1M/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=7HcUwZisCB73b3B0uOPip88y8QSxEQRxQZ80OzhXxBs",
    "https://chat.googleapis.com/v1/spaces/AAQAmDz98iM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=w482FGLLydLrWRDA0-EFwwyeKtUuj5z372RZMXXkjGs",
    "https://chat.googleapis.com/v1/spaces/AAQACGzXMPM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=71-Juuzn6nN0-t9eKeYmhpCvcsfK4-9eSWcF_KUk21Y"
  ];

  var map = {};
  urls.forEach(function(url) {
    var match = url.match(/spaces\/([^/]+)/);
    if (match) {
      map["spaces/" + match[1]] = url;
    }
  });

  var props = PropertiesService.getScriptProperties();
  props.setProperty("WEBHOOK_URLS", urls.join(","));
  props.setProperty("WEBHOOK_MAP", JSON.stringify(map));
  props.deleteProperty("SPACE_IDS");

  Logger.log("設定完了!");
  Logger.log("WEBHOOK_URLS: " + urls.length + "件");
  Logger.log("WEBHOOK_MAP: " + Object.keys(map).length + "件");
}
