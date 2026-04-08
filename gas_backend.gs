// ====================================================
// アドアーチグループ フォーム営業ツール - GAS Backend
// ====================================================
// 【セットアップ手順】
// 1. Google Driveで新しいスプレッドシートを作成
// 2. URLの /d/XXXX/edit の XXXX をコピー
// 3. 下の SHEET_ID = '' の '' の中に貼り付ける
// 4. ALLOWED_DOMAIN をあなたの会社ドメインに変更（例: 'adarch.co.jp'）
// 5. GASエディタで「デプロイ」→「新しいデプロイ」
//    種類: ウェブアプリ
//    実行ユーザー: 自分
//    アクセスできるユーザー: 組織内の全員（Google Workspace）
// 6. 表示されたURLを全員に共有
// ====================================================

const SHEET_ID      = '';             // ← スプレッドシートIDをここに入力
const ALLOWED_DOMAIN = '';            // ← 例: 'adarch.co.jp' (空文字で制限なし)

// --------------------------------------------------
// Web App エントリーポイント
// --------------------------------------------------
function doGet() {
  if (ALLOWED_DOMAIN) {
    const email = Session.getActiveUser().getEmail();
    if (!email || !email.endsWith('@' + ALLOWED_DOMAIN)) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;text-align:center;padding:80px 20px;">' +
        '<h2 style="color:#ef4444;">⛔ アクセス権限がありません</h2>' +
        '<p>このツールは ' + ALLOWED_DOMAIN + ' のメンバー専用です。<br>' +
        '正しいGoogleアカウントでログインしてください。</p>' +
        '</div>'
      );
    }
  }
  return HtmlService.createHtmlOutputFromFile('form-sales')
    .setTitle('アドアーチグループ｜フォーム営業ツール')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --------------------------------------------------
// ユーザー情報
// --------------------------------------------------

// ログイン中ユーザーの情報を返す
function getUserInfo() {
  const email = Session.getActiveUser().getEmail();
  const props = PropertiesService.getUserProperties();

  // 表示名: 設定済みならそれを使う / なければメールの@前を使う
  let displayName = props.getProperty('displayName');
  if (!displayName || displayName.trim() === '') {
    displayName = email.split('@')[0];
  }

  // カラーインデックス: ユーザーごとに固定割り当て
  let colorIdx = props.getProperty('colorIdx');
  if (colorIdx === null) {
    colorIdx = String(Math.floor(Math.random() * 10));
    props.setProperty('colorIdx', colorIdx);
  }

  return { email, displayName, colorIdx: parseInt(colorIdx) };
}

// 表示名を保存する（ユーザー個別）
function setDisplayName(name) {
  if (!name || name.trim() === '') return false;
  PropertiesService.getUserProperties().setProperty('displayName', name.trim());
  return true;
}

// --------------------------------------------------
// 初期データ一括取得（ページロード時に1回呼ぶ）
// --------------------------------------------------
function getInitData() {
  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const user = getUserInfo();
  return {
    user,
    companies:  readJsonCell(ss, 'companies'),
    templates:  readJsonCell(ss, 'templates'),
    activities: getRecentActivities(ss, 150),
  };
}

// --------------------------------------------------
// 会社データ
// --------------------------------------------------
function saveCompanies(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  writeJsonCell(ss, 'companies', data);
  return true;
}

// --------------------------------------------------
// テンプレートデータ
// --------------------------------------------------
function saveTemplates(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  writeJsonCell(ss, 'templates', data);
  return true;
}

// --------------------------------------------------
// アクティビティログ
// --------------------------------------------------

// 1件追加（クライアントからfire-and-forgetで呼ぶ）
function addActivity(act) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreateSheet(ss, 'activities', [
    'id','userId','userName','userColor','action',
    'companyId','companyName','media','timestamp'
  ]);
  sheet.appendRow([
    act.id || '',
    act.userId    || '',
    act.userName  || '',
    act.userColor || '',
    act.action    || '',
    act.companyId   || '',
    act.companyName || '',
    act.media     || '',
    act.timestamp || new Date().toISOString(),
  ]);
  return true;
}

// 最新N件を取得（新しい順）
function getRecentActivities(ss, limit) {
  const sheet = ss.getSheetByName('activities');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0].map(String);
  const rows = data.slice(1)
    .reverse()
    .slice(0, limit)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
  return rows;
}

// --------------------------------------------------
// Sheets ヘルパー
// --------------------------------------------------

// "data" シートにキー/バリューでJSONを保存
function readJsonCell(ss, key) {
  const sheet = ss.getSheetByName('data');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      try { return JSON.parse(String(data[i][1])); } catch (e) { return []; }
    }
  }
  return [];
}

function writeJsonCell(ss, key, value) {
  const sheet = getOrCreateSheet(ss, 'data', ['key', 'value', 'updatedAt']);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) {
      sheet.getRange(i + 1, 2).setValue(JSON.stringify(value));
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      return;
    }
  }
  // キーが存在しなければ新規追加
  sheet.appendRow([key, JSON.stringify(value), new Date().toISOString()]);
}

// シートが存在しなければ作成してヘッダーを追加
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
