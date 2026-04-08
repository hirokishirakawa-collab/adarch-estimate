/**
 * メール領収書 → Google Drive 自動保存スクリプト
 * MF経費のGoogle Drive連携で自動取込させる
 *
 * 初回セットアップ:
 * 1. Google Drive に「MF経費_領収書」フォルダを作成
 * 2. そのフォルダIDを DRIVE_FOLDER_ID に設定
 * 3. MF経費側でGoogle Drive連携を設定し、同フォルダを監視対象に
 * 4. トリガー設定: setupTrigger() を1回実行
 */

// ========== 設定 ==========

/** 領収書保存先のGoogle DriveフォルダID */
const DRIVE_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') || '';

/** 検索対象の送信元ドメイン/アドレス */
const SENDER_DOMAINS = [
  'fiverr.com',
  'crowdworks.jp',
  // SaaS系
  'adobe.com',
  'google.com',
  'microsoft.com',
  'zoom.us',
  'slack.com',
  'notion.so',
  'figma.com',
  'github.com',
  'atlassian.com',
  'dropbox.com',
  'canva.com',
  'openai.com',
  'anthropic.com',
  'vercel.com',
  'railway.app',
  'heroku.com',
  'aws.amazon.com',
  'cloudflare.com',
  // 決済・EC
  'amazon.co.jp',
  'amazon.com',
  'paypal.com',
  'stripe.com',
  // 通信・インフラ
  'ntt.com',
  'kddi.com',
  'softbank.jp',
  // その他（必要に応じて追加）
];

/** 件名キーワード（送信元に関係なくマッチ） */
const SUBJECT_KEYWORDS = [
  '領収書',
  '請求書',
  'receipt',
  'invoice',
  '利用明細',
  'ご請求',
  'お支払い',
  'payment confirmation',
  'payment receipt',
  'order confirmation',
];

/** 対象の添付ファイル拡張子 */
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];

/** 処理済みラベル名 */
const PROCESSED_LABEL_NAME = 'MF経費_処理済み';

/** 一度に処理するメール数の上限 */
const MAX_THREADS = 30;

// ========== メイン処理 ==========

/**
 * メイン: 領収書メールをスキャンしてDriveに保存
 */
function scanAndSaveReceipts() {
  const folder = getDriveFolder_();
  if (!folder) {
    Logger.log('エラー: DRIVE_FOLDER_ID が設定されていません');
    return;
  }

  const label = getOrCreateLabel_(PROCESSED_LABEL_NAME);
  const query = buildSearchQuery_();
  const threads = GmailApp.search(query, 0, MAX_THREADS);

  Logger.log(`検索クエリ: ${query}`);
  Logger.log(`対象スレッド数: ${threads.length}`);

  let savedCount = 0;

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      const count = processMessage_(message, folder);
      savedCount += count;
    }
    thread.addLabel(label);
  }

  Logger.log(`処理完了: ${savedCount} ファイルを保存しました`);
}

/**
 * メッセージから添付ファイルを抽出してDriveに保存
 */
function processMessage_(message, folder) {
  const attachments = message.getAttachments();
  if (attachments.length === 0) return 0;

  const date = message.getDate();
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  const from = message.getFrom();
  const subject = message.getSubject();
  let count = 0;

  for (const attachment of attachments) {
    const name = attachment.getName();
    const ext = getExtension_(name);

    if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) continue;

    // ファイル名: 日付_送信元_元のファイル名
    const senderName = extractSenderName_(from);
    const fileName = `${dateStr}_${senderName}_${name}`;

    // 重複チェック
    const existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
      Logger.log(`スキップ（既存）: ${fileName}`);
      continue;
    }

    const blob = attachment.copyBlob().setName(fileName);
    folder.createFile(blob);
    Logger.log(`保存: ${fileName} (from: ${from}, subject: ${subject})`);
    count++;
  }

  return count;
}

// ========== ユーティリティ ==========

/**
 * Gmail検索クエリを構築
 * 送信元ドメインまたは件名キーワードにマッチし、未処理のもの
 */
function buildSearchQuery_() {
  const senderParts = SENDER_DOMAINS.map(d => `from:${d}`);
  const subjectParts = SUBJECT_KEYWORDS.map(k => `subject:${k}`);

  const allConditions = [...senderParts, ...subjectParts];
  const orClause = `{${allConditions.join(' ')}}`;

  // has:attachment + 未処理 + 過去90日
  return `${orClause} has:attachment -label:${PROCESSED_LABEL_NAME} newer_than:90d`;
}

/**
 * 保存先フォルダを取得
 */
function getDriveFolder_() {
  if (!DRIVE_FOLDER_ID) return null;
  try {
    return DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (e) {
    Logger.log(`フォルダ取得エラー: ${e.message}`);
    return null;
  }
}

/**
 * ラベルを取得（なければ作成）
 */
function getOrCreateLabel_(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
    Logger.log(`ラベル作成: ${name}`);
  }
  return label;
}

/**
 * ファイル名から拡張子を取得
 */
function getExtension_(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * メールアドレスから送信者名を抽出
 */
function extractSenderName_(from) {
  // "Name <email@example.com>" → "Name"
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim().replace(/[\/\\:*?"<>|]/g, '_');
  // email@example.com → emailのドメイン部分
  const emailMatch = from.match(/@([^.]+)/);
  if (emailMatch) return emailMatch[1];
  return 'unknown';
}

// ========== セットアップ ==========

/**
 * 時間ベースのトリガーを設定（毎日9時に実行）
 */
function setupTrigger() {
  // 既存トリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'scanAndSaveReceipts') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger('scanAndSaveReceipts')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('トリガー設定完了: 毎日9:00に実行');
}

/**
 * 手動テスト用: 直近のメールを1件だけ処理
 */
function testRun() {
  const folder = getDriveFolder_();
  if (!folder) {
    Logger.log('エラー: DRIVE_FOLDER_ID を設定してください');
    Logger.log('スクリプトプロパティ > DRIVE_FOLDER_ID にGoogle DriveフォルダIDを入力');
    return;
  }

  const query = buildSearchQuery_();
  Logger.log(`検索クエリ: ${query}`);

  const threads = GmailApp.search(query, 0, 1);
  if (threads.length === 0) {
    Logger.log('対象メールが見つかりませんでした');
    return;
  }

  const messages = threads[0].getMessages();
  for (const message of messages) {
    Logger.log(`件名: ${message.getSubject()}`);
    Logger.log(`From: ${message.getFrom()}`);
    Logger.log(`添付: ${message.getAttachments().length} 件`);
    const count = processMessage_(message, folder);
    Logger.log(`保存: ${count} ファイル`);
  }
  // テスト時はラベル付けしない
}
