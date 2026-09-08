// TVer小口申込（お客様向け・ログイン不要）— 専用の外枠。OSのサイドバー等は出さない
import type { Metadata } from "next";
import "./order.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TverOrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tver-order order-page">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      {children}
    </div>
  );
}
