/**
 * 「動きを出す」カード — 各社のChatスペースへ、1タップで開ける入口を置く
 *
 * 押すと OS の /move?space=... が開き、
 * 会社名を打って 業界・当たり方・今どこ を選ぶだけで GROUP LIVE に流れる。
 * 金額の入力欄は存在しない。
 *
 * ── セットアップ ──
 * 置き場所は「グループサポートbot」のGASプロジェクト
 * （Code.gs / Config.gs / CardBuilder.gs / FollowUp.gs が入っているもの）。
 * WEBHOOK_URLS と API_BASE_URL は既存のものをそのまま使うので、追加設定は不要。
 *
 * 1. ＋ → スクリプト でファイルを足し、この中身を貼る
 * 2. postMoveCardToAll() を一度手で実行して、各スペースにカードが出るか確認
 * 3. 常設にするならトリガー: 関数=postMoveCardToAll / 週ベース / 好きな曜日
 *    （毎日は多いので、週1〜2回が目安）
 */

/** 全スペースへ「動きを出す」カードを配信 */
function postMoveCardToAll() {
  var webhooks = getWebhookUrls_();
  var baseUrl = getConfig().API_BASE_URL + '/move';
  var nameMap = buildCallNameMap_();
  var sent = 0;

  webhooks.forEach(function (webhookUrl) {
    var spaceId = extractSpaceId_(webhookUrl);
    var key = spaceId.replace(/^spaces\//, '');
    var moveUrl = baseUrl + '?space=' + encodeURIComponent(spaceId);
    var callName = nameMap[key] || '';

    var payload = JSON.stringify({
      cardsV2: [{ cardId: 'move-card', card: buildMoveCard(moveUrl, callName) }],
    });

    try {
      UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true,
      });
      sent++;
    } catch (e) {
      Logger.log('送信失敗(' + key + '): ' + e.message);
    }
  });

  Logger.log('動きカード配信完了: ' + sent + '/' + webhooks.length + '社');
}

/** 自分のスペースにだけ試し打ちする（1件目のwebhookへ） */
function testMoveCard() {
  var webhooks = getWebhookUrls_();
  if (!webhooks.length) {
    Logger.log('WEBHOOK_URLS が未設定です');
    return;
  }
  var spaceId = extractSpaceId_(webhooks[0]);
  var moveUrl = getConfig().API_BASE_URL + '/move?space=' + encodeURIComponent(spaceId);
  UrlFetchApp.fetch(webhooks[0], {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      cardsV2: [{ cardId: 'move-card', card: buildMoveCard(moveUrl, '') }],
    }),
    muteHttpExceptions: true,
  });
  Logger.log('テスト配信しました: ' + spaceId);
}

/**
 * カード本体。
 * トーン: 週次カードと同じ「サポート事務局」。催促しない・管理しない。
 */
function buildMoveCard(moveUrl, callName) {
  var title = (callName ? callName + '、' : '') + '今日はどこかに当たりましたか？';

  return {
    header: {
      title: 'GROUP LIVE',
      subtitle: 'ひとつ出すと、グループに流れます',
      imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/bolt/default/48px.svg',
      imageType: 'CIRCLE',
    },
    sections: [
      {
        widgets: [
          {
            decoratedText: {
              text: '<b>' + title + '</b>',
              wrapText: true,
            },
          },
          {
            decoratedText: {
              text: '会社名を打って、あとは選ぶだけです。<br>紹介・飛び込み・既存のお客様への提案も、どうぞ 😊',
              wrapText: true,
            },
          },
          {
            buttonList: {
              buttons: [
                {
                  text: '動きを出す',
                  onClick: { openLink: { url: moveUrl } },
                },
              ],
            },
          },
          {
            decoratedText: {
              text: '<font color="#888888">金額の入力欄はありません</font>',
              wrapText: true,
            },
          },
        ],
      },
    ],
  };
}
