// Ad Arch Studio（AI相談窓口）ご利用条件の公開ページ（ログインなし）。
//   /api/mcp 配下＝proxy の対象外（matcher の除外）なので、ログインなしで誰でも読める。正本は src/lib/studio/terms.ts
import { studioTermsHtml } from "@/lib/studio/terms";

export const dynamic = "force-static";

export function GET() {
  return new Response(studioTermsHtml(), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
