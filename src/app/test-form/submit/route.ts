import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get("name")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const message = formData.get("message")?.toString() ?? "";

  // DBに記録
  await db.appSetting.upsert({
    where: { key: "test-form-last-submission" },
    create: {
      key: "test-form-last-submission",
      value: JSON.stringify({ name, email, message, at: new Date().toISOString() }),
    },
    update: {
      value: JSON.stringify({ name, email, message, at: new Date().toISOString() }),
    },
  });

  console.log(`[test-form] 受信: name=${name}, email=${email}, message=${message.substring(0, 50)}`);

  // 完了ページにリダイレクト
  const url = new URL("/test-form", req.url);
  url.searchParams.set("submitted", "true");
  url.searchParams.set("name", name);
  url.searchParams.set("email", email);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, 303);
}
