// ==============================================================
// CardBuilder.gs — カード・ダイアログUI構築
// ==============================================================

/**
 * 月曜配信カード — 週次シェアの呼びかけ
 * トーン: サポート事務局スタッフ（上司でも監視者でもない）
 * @param {string} submitUrl - Webフォームの URL
 */
function buildMondayCard(submitUrl) {
  return {
    header: {
      title: '今週もお疲れさまです！',
      subtitle: 'サポート事務局より',
      imageUrl:
        'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/handshake/default/48px.svg',
      imageType: 'CIRCLE',
    },
    sections: [
      {
        widgets: [
          {
            textParagraph: {
              text: '今週の様子をシェアしていただけると嬉しいです 🙌\n5問・1分ほどで完了します。',
            },
          },
          {
            buttonList: {
              buttons: [
                {
                  text: '今週のシェアを始める',
                  onClick: {
                    openLink: {
                      url: submitUrl,
                    },
                  },
                  color: {
                    red: 0.145,
                    green: 0.388,
                    blue: 0.922,
                    alpha: 1,
                  },
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
