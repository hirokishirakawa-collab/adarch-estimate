// LINE チャネルの秘密情報は予約システムと同じ AES-256-GCM（AUTH_SECRET 派生鍵）で保存する
export { encryptToken as encryptSecret, decryptToken as decryptSecret } from "@/lib/booking/google";
