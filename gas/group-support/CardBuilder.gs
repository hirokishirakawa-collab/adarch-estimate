// ==============================================================
// CardBuilder.gs — カード・ダイアログUI構築
// ==============================================================

/**
 * 月曜配信カード — 週次シェアの呼びかけ
 * トーン: サポート事務局スタッフ（上司でも監視者でもない）
 */
function buildMondayCard() {
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
                    action: {
                      function: 'onCardClick',
                      interaction: 'OPEN_DIALOG',
                      parameters: [
                        { key: 'action', value: 'openWeeklyDialog' },
                      ],
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
 * 5問ダイアログ
 */
function buildWeeklyDialog() {
  return {
    action_response: {
      type: 'DIALOG',
      dialog_action: {
        dialog: {
          body: {
            header: {
              title: '今週の様子をシェア',
              subtitle: 'サポート事務局',
            },
            sections: [
              {
                widgets: [
                  // Q1: 今週の調子
                  {
                    selectionInput: {
                      name: 'q1',
                      label: 'Q1. 今週の調子はいかがですか？',
                      type: 'DROPDOWN',
                      items: [
                        {
                          text: 'いい感じ 👍',
                          value: 'いい感じ',
                          selected: false,
                        },
                        {
                          text: 'ちょっと苦戦中 💪',
                          value: 'ちょっと苦戦中',
                          selected: false,
                        },
                        {
                          text: '手が止まっている 🤔',
                          value: '手が止まっている',
                          selected: false,
                        },
                      ],
                    },
                  },
                  // Q2: 今週やったこと
                  {
                    textInput: {
                      name: 'q2',
                      label: 'Q2. 今週やったこと（箇条書きでOK）',
                      type: 'MULTIPLE_LINE',
                    },
                  },
                  // Q3: 来週やること
                  {
                    textInput: {
                      name: 'q3',
                      label: 'Q3. 来週やること',
                      type: 'MULTIPLE_LINE',
                    },
                  },
                  // Q4: 共有・相談
                  {
                    textInput: {
                      name: 'q4',
                      label: 'Q4. 共有・相談したいこと（なければ「特になし」でOK）',
                      type: 'MULTIPLE_LINE',
                    },
                  },
                  // Q5: サポート
                  {
                    selectionInput: {
                      name: 'q5',
                      label: 'Q5. 本部からのサポートは必要ですか？',
                      type: 'DROPDOWN',
                      items: [
                        {
                          text: '今は大丈夫 😊',
                          value: '今は大丈夫',
                          selected: false,
                        },
                        {
                          text: 'あると助かる 🙏',
                          value: 'あると助かる',
                          selected: false,
                        },
                        {
                          text: 'できれば早めに欲しい 🆘',
                          value: 'できれば早めに欲しい',
                          selected: false,
                        },
                      ],
                    },
                  },
                ],
              },
            ],
            fixedFooter: {
              primaryButton: {
                text: 'シェアする',
                onClick: {
                  action: {
                    function: 'onCardClick',
                    parameters: [
                      { key: 'action', value: 'submitWeekly' },
                    ],
                  },
                },
                color: {
                  red: 0.145,
                  green: 0.388,
                  blue: 0.922,
                  alpha: 1,
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * お礼カード（回答送信後に表示）
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
