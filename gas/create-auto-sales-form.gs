/**
 * 自動営業サービス 利用申し込みフォームを作成
 * GASエディタに貼り付けて実行 → ログにフォームURLが出力される
 */
function createAutoSalesForm() {
  var form = FormApp.create('【Ad Arch】自動営業サービス 利用申し込み');
  form.setDescription(
    'Ad Arch OS の新機能「自動営業サービス」の利用申し込みフォームです。\n' +
    'ご希望いただき、ルールにご同意いただいた方から順次サービスを開放いたします。'
  );
  form.setConfirmationMessage('お申し込みありがとうございます。\n内容を確認のうえ、順次サービスを開放いたします。');
  form.setCollectEmail(true);

  // 1. 会社名
  form.addTextItem()
    .setTitle('会社名')
    .setHelpText('例: ○○ AdArch')
    .setRequired(true);

  // 2. 代表者名
  form.addTextItem()
    .setTitle('代表者名（ご担当者名）')
    .setHelpText('例: 宮本 貴史')
    .setRequired(true);

  // 3. 利用希望
  form.addMultipleChoiceItem()
    .setTitle('自動営業サービスの利用を希望しますか？')
    .setChoiceValues(['希望する', '詳しく聞いてから判断したい', '希望しない'])
    .setRequired(true);

  // 4. 主な営業エリア
  form.addTextItem()
    .setTitle('主な営業エリア')
    .setHelpText('例: 徳島県全域、大阪市内 など')
    .setRequired(true);

  // 5. ターゲット業種
  form.addTextItem()
    .setTitle('ターゲットにしたい業種（任意）')
    .setHelpText('例: 美容室、工務店、飲食店 など（未定の場合は「未定」で構いません）')
    .setRequired(false);

  // 6. ルール同意
  form.addCheckboxItem()
    .setTitle('以下のルールに同意します（すべてチェックしてください）')
    .setHelpText('サービスご利用にあたり、以下3点へのご同意が必要です。')
    .setChoiceValues([
      '既存顧客を事前登録し、重複アプローチを防止します',
      'リードからの返答には営業時間内12時間以内に対応します',
      'クレーム発生時は1時間以内に本部へ共有します（対応は本部主導）'
    ])
    .setRequired(true);

  // 7. 備考
  form.addParagraphTextItem()
    .setTitle('備考・ご質問（任意）')
    .setHelpText('ご不明な点やご要望がございましたらご記入ください')
    .setRequired(false);

  // ログにURL出力
  var editUrl = form.getEditUrl();
  var publishUrl = form.getPublishedUrl();

  Logger.log('========================================');
  Logger.log('フォーム作成完了!');
  Logger.log('編集URL: ' + editUrl);
  Logger.log('公開URL: ' + publishUrl);
  Logger.log('========================================');
}
