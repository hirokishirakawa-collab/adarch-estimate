// ==============================================================
// Ad Arch Studio の自社ドメイン（2026-09-20 代表決定・公式コネクタ一覧への申請の前提＝ドメイン所有）
//   https://studio.adarch.co.jp/            … 紹介ページ（public/studio/index.html＋同じフォルダのCSS・画像）
//   https://studio.adarch.co.jp/mcp         … 企業向け（= /api/mcp/public）
//   https://studio.adarch.co.jp/mcp/creator … 制作者向け（= /api/mcp/public/creator）
//   https://studio.adarch.co.jp/terms       … 利用条件（= /api/mcp/public/terms）
//   それ以外のパス（OSのログイン・ダッシュボード・API・/.well-known）は studio ドメインでは全部404。
//   振り分けは next.config.ts の rewrites（beforeFiles）と src/proxy.ts の先頭で行う。
//   ⚠️ next.config.ts はこのファイルを import できないので、ホスト名は同じ値を直書きしている（変えるときは両方）
// ==============================================================

export const STUDIO_HOST = "studio.adarch.co.jp";
export const STUDIO_ORIGIN = `https://${STUDIO_HOST}`;

/** studio ドメインで開いてよいパス（これ以外は404）。紹介ページのCSS・画像（拡張子つきのパス）は isStudioAssetPath */
export const STUDIO_ALLOWED_PATHS = ["/", "/mcp", "/mcp/creator", "/terms"] as const;

/** 紹介ページ（public/studio/）から相対パスで読むファイル（/style.css・/images/a.jpg など）。/api/ と .. は除く */
export function isStudioAssetPath(pathname: string): boolean {
  return /^\/(?!api\/)[^?#]+\.[A-Za-z0-9]{1,5}$/.test(pathname) && !pathname.includes("..");
}

export function isStudioAllowedPath(pathname: string): boolean {
  return (STUDIO_ALLOWED_PATHS as readonly string[]).includes(pathname) || isStudioAssetPath(pathname);
}

/** リクエストのホストが studio ドメインか（ポート付き・大文字も許す） */
export function isStudioHost(host: string | null | undefined): boolean {
  const h = (host ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  return h === STUDIO_HOST;
}
