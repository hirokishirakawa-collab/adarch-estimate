// studio.adarch.co.jp で「開いてよい4つのパス」以外に来たときの行き先（next.config.ts の rewrites の最後の行）。
//   OSの画面・API・/.well-known（認証の案内）を studio ドメインで見せないため、何も返さず404だけ返す。
const notFound = () => new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
