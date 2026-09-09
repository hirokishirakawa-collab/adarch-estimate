// 業種×市の営業用LP（お客様向け・ログイン不要）— 専用の外枠。OSのサイドバー等は出さない
import type { Metadata } from "next";
import "./lp.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="aa-lp">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      {children}
    </div>
  );
}
