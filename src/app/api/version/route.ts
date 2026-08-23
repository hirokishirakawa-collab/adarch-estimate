export const dynamic = "force-dynamic";

/**
 * GET /api/version
 *
 * 本番が今どのコミットで動いているかを外から確認するためだけのエンドポイント。
 * デプロイが反映されたかを、画面にログインせずに判定できるようにする。
 *
 * 返すのはコミットの短縮ID（7桁）とブランチ名だけ。
 * 環境変数の中身や設定の有無は一切返さない（/api/health は ADMIN 専用のまま）。
 *
 * コミットIDは Railway がランタイムに渡す RAILWAY_GIT_COMMIT_SHA から取る。
 * ローカルでは渡らないので "local" を返す。
 */
export async function GET() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA ?? "";

  return Response.json(
    {
      commit: sha ? sha.slice(0, 7) : "local",
      branch: process.env.RAILWAY_GIT_BRANCH ?? "local",
      startedAt: new Date(Date.now() - Math.floor(process.uptime() * 1000)).toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
