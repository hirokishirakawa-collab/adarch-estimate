// ==============================================================
// Code.gs — エントリポイント（Webhook版）
// ==============================================================

function triggerMondayCard() {
  // 重複実行防止（同日2回目はスキップ）
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LAST_MONDAY_CARD') === today) {
    Logger.log('本日は既に配信済み。スキップします。');
    return;
  }
  props.setProperty('LAST_MONDAY_CARD', today);

  // 呼びかけ名マップ（spaceId → 「歌丸さん」）と週インデックス（週替わり用）
  var nameMap = buildCallNameMap_();
  var weekIndex = getWeekIndex_();

  var webhooks = getWebhookUrls_();
  var baseUrl = getConfig().API_BASE_URL + '/group-support/submit';

  webhooks.forEach(function (webhookUrl) {
    var spaceId = extractSpaceId_(webhookUrl);          // "spaces/XXX"
    var key = spaceId.replace(/^spaces\//, '');         // "XXX"（DB側はprefix有無が混在するため正規化）
    var submitUrl = baseUrl + '?space=' + encodeURIComponent(spaceId);
    var callName = nameMap[key] || '';
    var card = buildMondayCard(submitUrl, callName, weekIndex);
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

  Logger.log('月曜カード配信完了: ' + webhooks.length + '社 (week#' + weekIndex + ')');
  markAllSpacesAsRead();
}

/**
 * 週インデックス（週替わりローテーション用）。月曜配信ごとに +1 される。
 */
function getWeekIndex_() {
  var ms = new Date().getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

/**
 * 呼びかけ名マップを status API から構築（spaceId → 「歌丸さん」）
 * 取得失敗時は空マップ＝汎用挨拶で続行（送信は止めない）
 */
function buildCallNameMap_() {
  var map = {};
  try {
    var status = getSubmissionStatus();
    var all = (status.submitted || []).concat(status.notSubmitted || []);
    all.forEach(function (c) {
      if (!c.chatSpaceId) return;
      var key = String(c.chatSpaceId).replace(/^spaces\//, '');
      map[key] = toCallName_(c.name, c.ownerName);
    });
  } catch (e) {
    Logger.log('呼びかけ名マップ構築失敗（汎用挨拶で続行）: ' + e.message);
  }
  return map;
}

/**
 * 呼びかけ名を作る。
 * "姓 名（地域）" → 「姓さん」。法人名(株式会社等)で登録の場合は代表者名(ownerName)で呼びかける。
 */
function toCallName_(name, ownerName) {
  var base = name || '';
  if (/^(株式会社|有限会社|合同会社)/.test(base) && ownerName) {
    base = ownerName; // 例: 「株式会社Pleete」→ 代表者「遠藤 創平」
  }
  var head = String(base).split(/[\s　（(]/)[0];
  if (!head) return '';
  if (/^(株式会社|有限会社|合同会社)/.test(head)) return head;
  return head + 'さん';
}

function triggerTuesdayFollowUp() {
  // 重複実行防止
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LAST_TUESDAY_FOLLOWUP') === today) {
    Logger.log('本日は既にフォローアップ済み。スキップします。');
    return;
  }
  props.setProperty('LAST_TUESDAY_FOLLOWUP', today);

  followUpUnsubmitted(1);
  markAllSpacesAsRead();
}

function triggerWednesdayFollowUp() {
  // 重複実行防止
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LAST_WEDNESDAY_FOLLOWUP') === today) {
    Logger.log('本日は既にフォローアップ済み。スキップします。');
    return;
  }
  props.setProperty('LAST_WEDNESDAY_FOLLOWUP', today);

  followUpUnsubmitted(2);
  markAllSpacesAsRead();
}

function triggerThursdayCeoDigest() {
  // 重複実行防止
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('LAST_THURSDAY_DIGEST') === today) {
    Logger.log('本日は既にダイジェスト送信済み。スキップします。');
    return;
  }
  props.setProperty('LAST_THURSDAY_DIGEST', today);

  sendCeoDigest();
  markAllSpacesAsRead();
}

// ==============================================================
// 内部ヘルパー
// ==============================================================

function getWebhookUrls_() {
  var raw = PropertiesService.getScriptProperties().getProperty('WEBHOOK_URLS') || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

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
  // テスト用：重複防止をリセットしてから実行
  PropertiesService.getScriptProperties().deleteProperty('LAST_MONDAY_CARD');
  triggerMondayCard();
}

/** 全スペースを既読にする */
function markAllSpacesAsRead() {
  var webhooks = getWebhookUrls_();
  Logger.log('Webhook数: ' + webhooks.length);

  webhooks.forEach(function(webhookUrl) {
    var spaceId = extractSpaceId_(webhookUrl);
    Logger.log('処理中: ' + spaceId);
    if (spaceId) {
      try {
        var url = 'https://chat.googleapis.com/v1/users/me/' + spaceId + '/spaceReadState?updateMask=lastReadTime';
        var payload = {
          lastReadTime: new Date().toISOString()
        };
        var response = UrlFetchApp.fetch(url, {
          method: 'patch',
          contentType: 'application/json',
          headers: {
            'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });
        Logger.log('結果: ' + response.getResponseCode() + ' ' + response.getContentText());
      } catch(e) {
        Logger.log('既読失敗: ' + spaceId + ' - ' + e.message);
      }
    }
  });
  Logger.log('既読処理完了');
}

function suspendInactiveUsers() {
  const url = "https://adarch-estimate-production.up.railway.app/api/cron/suspend-inactive";
  const options = {
    method: "get",
    headers: {
      "Authorization": "Bearer 2c147fd0237bc50249028be716db558bf5f41934eb82c46976f9072e0c91181c"
    }
  };
  const res = UrlFetchApp.fetch(url, options);
  Logger.log(res.getContentText());
}

/**
 * Script Properties を再設定（setupWebhookProperties）
 * 新規加盟時にURLを追加して実行する
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
    "https://chat.googleapis.com/v1/spaces/AAQAc-b0LvA/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=-Af_C7dv6GBcsqKWFxP6k7zOI78r67K9zYme3rjLaOI",
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
    "https://chat.googleapis.com/v1/spaces/AAQACGzXMPM/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=71-Juuzn6nN0-t9eKeYmhpCvcsfK4-9eSWcF_KUk21Y",
    // Rawfeel（台湾/東京）
    "https://chat.googleapis.com/v1/spaces/AAQAm1b7U3U/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=MqF6No4g_p67qJKKX-FsGgKqIsmecp40YkS5qgYwsvM",
    // 遠藤 創平（株式会社Pleete・東京港区）2026-06-01加盟
    "https://chat.googleapis.com/v1/spaces/AAQAvXmjPXY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=CWylIdnsyZKqdRVjfwbAS70DIjEHvtyinuD06qzG3W4"
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

function triggerPartnerStatusCron() {
  const url = 'https://adarch-estimate-production.up.railway.app/api/cron/partner-status';
  const secret = 'ここにCRON_SECRETの値';

  UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + secret }
  });
}
