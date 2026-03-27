import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

function getDriveClient() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON が未設定");
  const credentials = JSON.parse(saJson);
  const delegateEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();

  const authClient = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    subject: delegateEmail,
  });

  return google.drive({ version: "v3", auth: authClient });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");
  if (!fileId) {
    return new NextResponse("id is required", { status: 400 });
  }

  try {
    const drive = getDriveClient();

    // ファイルサイズ取得
    const meta = await drive.files.get({
      fileId,
      fields: "size,mimeType,name",
    });
    const fileSize = parseInt(meta.data.size ?? "0", 10);
    const mimeType = meta.data.mimeType ?? "video/mp4";

    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      // Range request — 部分読み込み（ストリーミング対応）
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      const start = parseInt(match?.[1] ?? "0", 10);
      const end = match?.[2] ? parseInt(match[2], 10) : Math.min(start + 5 * 1024 * 1024 - 1, fileSize - 1); // 5MB chunks

      const res = await drive.files.get(
        { fileId, alt: "media" },
        {
          responseType: "arraybuffer",
          headers: { Range: `bytes=${start}-${end}` },
        }
      );

      const chunk = Buffer.from(res.data as ArrayBuffer);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${start}-${start + chunk.length - 1}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    } else {
      // No range — return full file info with Accept-Ranges
      // Browser will then make range requests
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  } catch (e) {
    console.error("[stream] Error:", e);
    return new NextResponse("Stream error", { status: 500 });
  }
}
