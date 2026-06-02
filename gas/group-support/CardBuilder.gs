// ==============================================================
// CardBuilder.gs — カード・ダイアログUI構築
// ==============================================================

/**
 * 月曜配信カード — 週次シェアの呼びかけ
 * トーン: サポート事務局スタッフ（上司でも監視者でもない）
 * NG語: 報告/催促/未提出/管理/リマインド
 * @param {string} submitUrl - Webフォームの URL
 * @param {string} callName  - 呼びかけ名（例:「歌丸さん」）。空なら無印
 * @param {number} weekIndex - 週インデックス（週替わりローテーション用）
 */
function buildMondayCard(submitUrl, callName, weekIndex) {
  var idx = (typeof weekIndex === 'number' && weekIndex >= 0) ? weekIndex : 0;

  // 週替わり: 挨拶（マンネリ防止のためローテーション）
  var greetings = [
    '今週もお疲れさまです！',
    'おはようございます！',
    '新しい一週間ですね 🌱',
    '今週もよろしくお願いします！',
    '一週間のはじまりですね！',
    'こんにちは！今週もどうぞ',
  ];
  // 週替わり: 本文の呼びかけ（greetingsと長さを変えて組合せを増やす）
  var bodyLines = [
    '今週の調子はいかがですか？😊',
    '最近どんな感じか、聞かせてください 🙌',
    'ちょっとした近況でも大歓迎です 😊',
    'うまくいったこと・気になること、どちらでも 🙌',
    '今週の一歩を、ぜひシェアしてください 😊',
    'お忙しいと思いますが、ひとことだけでも 🙌',
    '無理のない範囲で、近況をどうぞ 😊',
  ];

  var greeting = greetings[idx % greetings.length];
  var body = bodyLines[idx % bodyLines.length];
  var title = (callName ? callName + '、' : '') + greeting;

  return {
    header: {
      title: title,
      subtitle: 'サポート事務局より',
      imageUrl:
        'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/handshake/default/48px.svg',
      imageType: 'CIRCLE',
    },
    sections: [
      {
        widgets: [
          {
            textParagraph: { text: body },
          },
          {
            decoratedText: {
              startIcon: { knownIcon: 'CLOCK' },
              text: '5問でかんたん',
              bottomLabel: '所要 約1分',
            },
          },
          { divider: {} },
          {
            buttonList: {
              buttons: [
                {
                  text: '今週のシェアを始める',
                  onClick: { openLink: { url: submitUrl } },
                  color: { red: 0.145, green: 0.388, blue: 0.922, alpha: 1 },
                },
                {
                  text: 'ちょっと相談したい',
                  onClick: { openLink: { url: submitUrl + '&intent=consult' } },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

/**
 * お礼カード（不要になったが念のため残す）
 */
function buildThankYouCard(companyName) {
  return {
    action_response: {
      type: 'DIALOG',
      dialog_action: {
        dialog: {
          body: {
            sections: [
              {
                widgets: [
                  {
                    textParagraph: {
                      text:
                        'シェアありがとうございます！ 🎉\n\n' +
                        (companyName ? companyName + ' さんの' : '') +
                        '今週の共有を受け付けました。\n何かあればいつでもこちらのスペースでお気軽にどうぞ！',
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    },
  };
}
