/**
 * 自動営業の「同じ会社かどうか」を判定するためのドメイン正規化。
 *
 * 拠点Aが https://www.example.co.jp/contact 、拠点Bが https://example.co.jp/inquiry を
 * 登録していても同じ会社なので、必ずこの関数を通した値で突き合わせる。
 *
 * ワーカー側にも同じ実装が worker/src/domain.ts にある（別プロセス・別tsconfigのため）。
 * 片方を直したらもう片方も直すこと。
 */
export function normalizeDomain(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;
  try {
    const host = new URL(withScheme).hostname.toLowerCase();
    const stripped = host.startsWith("www.") ? host.slice(4) : host;
    return stripped || null;
  } catch {
    return null;
  }
}
