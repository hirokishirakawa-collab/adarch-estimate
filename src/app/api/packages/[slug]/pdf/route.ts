import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { renderHtmlToPdf } from "@/lib/pdf/chrome";
import { buildPackageCardHtml } from "@/lib/packages/card-html";
import { readStorageFile } from "@/lib/storage";

/** サムネイルを data: URL に（OS内ストレージの画像だけ。外部URLはChromeが file:// から読めないので出さない） */
function imageDataUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const m = /^\/api\/storage\/package-images\/([\w.-]+)$/.exec(imageUrl);
  if (!m) return null;
  const buf = readStorageFile("package-images", m[1]);
  return buf ? `data:image/jpeg;base64,${buf.toString("base64")}` : null;
}

export const runtime = "nodejs";

// GET /api/packages/[slug]/pdf
//   A4 1枚のパッケージカード（クライアントに渡す資料）。差出人は見ている人の会社
//   稼働中だけ出せる（提案中は本部が ?preview=1 で確認）
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

  const { slug } = await ctx.params;
  const [pkg, me] = await Promise.all([
    db.salesPackage.findUnique({ where: { slug } }),
    db.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, email: true, role: true, groupCompany: { select: { name: true } } },
    }),
  ]);
  if (!pkg || !me) return new NextResponse("Not Found", { status: 404 });

  const isPreview = req.nextUrl.searchParams.get("preview") === "1";
  if (pkg.status !== "ACTIVE" && !(me.role === "ADMIN" && isPreview)) {
    return new NextResponse("稼働中のパッケージだけ資料を出せます", { status: 403 });
  }

  const html = buildPackageCardHtml(
    pkg,
    {
      company: me.groupCompany?.name ?? "Ad Arch株式会社",
      name: me.name,
      email: me.email,
    },
    imageDataUrl(pkg.imageUrl),
  );

  let buffer: Buffer | null = null;
  try {
    buffer = await renderHtmlToPdf(html);
  } catch (e) {
    console.error("[package-pdf] render failed:", e instanceof Error ? e.message : e);
  }
  if (!buffer) return new NextResponse("PDFを作れる環境ではありません（Chromeなし）", { status: 503 });

  const filename = `${pkg.name}_パッケージ資料${isPreview ? "_下書き" : ""}.pdf`;
  const disposition = req.nextUrl.searchParams.get("dl") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
