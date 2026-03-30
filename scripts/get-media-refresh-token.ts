/**
 * media@adarch.co.jp 用の Google OAuth2 リフレッシュトークン取得スクリプト
 *
 * 手順:
 * 1. npx tsx scripts/get-media-refresh-token.ts
 * 2. ブラウザが開く → media@adarch.co.jp でログイン → 許可
 * 3. 自動でリフレッシュトークンが表示される
 * 4. Railway 環境変数に GOOGLE_REFRESH_TOKEN_MEDIA として設定
 */
import "dotenv/config";
import { google } from "googleapis";
import * as http from "http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ .env.local に GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定してください");
  process.exit(1);
}

const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];

// ローカルサーバーでコールバックを受け取る
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) return;

  const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(400);
    res.end("認証コードが見つかりません");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h2>✅ 認証成功！</h2>
        <p>ターミナルにトークンが表示されています。<br>このタブは閉じてOKです。</p>
      </body></html>
    `);

    console.log("\n✅ トークン取得成功！\n");
    console.log("==========================================");
    console.log("Railway 環境変数に以下を追加してください:");
    console.log("==========================================\n");
    console.log(`変数名: GOOGLE_REFRESH_TOKEN_MEDIA`);
    console.log(`値:     ${tokens.refresh_token}\n`);

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500);
    res.end("トークン取得失敗");
    console.error("❌ エラー:", err);
    server.close();
    process.exit(1);
  }
});

server.listen(REDIRECT_PORT, () => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    login_hint: "media@adarch.co.jp",
  });

  console.log("\n====================================");
  console.log("  media@adarch.co.jp OAuth2 設定");
  console.log("====================================\n");
  console.log("ブラウザで以下のURLを開いてください:\n");
  console.log(authUrl);
  console.log("\n（media@adarch.co.jp でログインしてください）\n");
  console.log("待機中...");
});
