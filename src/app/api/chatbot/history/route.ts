import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/chatbot/history — ADMIN専用: 全ユーザーのチャットボット会話履歴
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversations = await db.chatbotConversation.findMany({
    include: {
      user: { select: { name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ conversations });
}
