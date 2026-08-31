// /signage/player?token=<deviceToken>
//   サイネージ端末（TVスティック＋Fully Kiosk Browser 等）で全画面表示するプレイヤー。
//   ログイン不要（proxy.ts で除外）。端末トークンで /api/signage/d/<token>/* を叩く。
//   初回はトークン無しで開き、ペアリングコードを表示 → CMSで拠点に紐づけると再生開始。
import type { Metadata, Viewport } from "next";
import { SignagePlayer } from "./player";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ad Arch Signage Player", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#000000" };

export default async function SignagePlayerPage({ searchParams }: { searchParams: Promise<{ token?: string; debug?: string }> }) {
  const { token, debug } = await searchParams;
  return <SignagePlayer initialToken={token ?? null} debug={debug === "1"} />;
}
