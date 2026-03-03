// ==============================================================
// Config.gs — 設定値
// ==============================================================
// Script Properties に以下を設定:
//   API_BASE_URL : https://adarch-estimate-production.up.railway.app
//   API_KEY      : GROUP_SUPPORT_API_KEY と同じ値
// ==============================================================

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    API_BASE_URL: props.getProperty('API_BASE_URL') || '',
    API_KEY: props.getProperty('API_KEY') || '',
  };
}

/**
 * Webhook に POST リクエストを送信
 */
function postWebhook(path, payload) {
  var config = getConfig();
  var url = config.API_BASE_URL + path;

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': config.API_KEY,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = JSON.parse(response.getContentText());

  if (code !== 200) {
    Logger.log('Webhook error: ' + code + ' ' + JSON.stringify(body));
  }

  return { code: code, body: body };
}

/**
 * 提出状況を取得
 */
function getSubmissionStatus(weekId) {
  var config = getConfig();
  var url = config.API_BASE_URL + '/api/group-support/status';
  if (weekId) url += '?weekId=' + encodeURIComponent(weekId);

  var options = {
    method: 'get',
    headers: {
      'x-api-key': config.API_KEY,
    },
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}
