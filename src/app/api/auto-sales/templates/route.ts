import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AutoSalesTargetType, AutoSalesServiceType } from "@/generated/prisma/client";

const VALID_TARGET_TYPES: AutoSalesTargetType[] = ["BTOB", "BTOC"];
const VALID_SERVICE_TYPES: AutoSalesServiceType[] = [
  "VIDEO_PRODUCTION",
  "SNS_MANAGEMENT",
  "AD_MEDIA",
  "FIRST_MEETING",
];

// テンプレート一覧
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const branchFilter = isAdmin ? {} : { branchId: user.branchId! };
  const showArchived = req.nextUrl.searchParams.get("archived") === "true";

  const templates = await db.autoSalesTemplate.findMany({
    where: { ...branchFilter, isActive: !showArchived },
    include: { branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

// テンプレート作成（パートナーが営業設定を登録）
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || !user.branchId) {
    return NextResponse.json({ error: "Branch not assigned" }, { status: 400 });
  }
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    companyName,
    senderName,
    phone,
    email,
    websiteUrl,
    position,
    department,
    address,
    additionalInfo,
    targetType,
    serviceTypes,
    subject,
    messageBody,
    scheduledStartDate,
  } = body as {
    name: string;
    companyName: string;
    senderName: string;
    phone?: string;
    email?: string;
    websiteUrl?: string;
    position?: string;
    department?: string;
    address?: string;
    additionalInfo?: string;
    targetType: AutoSalesTargetType;
    serviceTypes: AutoSalesServiceType[];
    subject: string;
    messageBody: string;
    scheduledStartDate?: string;
  };

  // バリデーション
  if (!name || !companyName || !senderName || !targetType || !serviceTypes?.length) {
    return NextResponse.json(
      { error: "必須項目を入力してください（名前、会社名、送信者名、ターゲット種別、訴求カテゴリ）" },
      { status: 400 }
    );
  }

  // 件名と本文は人が書く。ここでAIが生成したり、定型を自動で足したりしない。
  const finalSubject = subject?.trim() ?? "";
  const finalBody = messageBody?.trim() ?? "";
  if (!finalSubject) {
    return NextResponse.json({ error: "件名を入力してください" }, { status: 400 });
  }
  if (!finalBody) {
    return NextResponse.json({ error: "本文を入力してください" }, { status: 400 });
  }
  if (finalBody.length < 30) {
    return NextResponse.json(
      { error: "本文が短すぎます。相手に届く文章として成立しているか確認してください。" },
      { status: 400 }
    );
  }

  // 返信先は必須。ここが空だと本部の media@ に相手の返信が集まり、拠点が反響に気づけない。
  const replyEmail = email?.trim().toLowerCase() ?? "";
  if (!replyEmail) {
    return NextResponse.json(
      { error: "メールアドレスを入力してください。相手からの返信はここに届きます。" },
      { status: 400 }
    );
  }
  if (!replyEmail.endsWith("@adarch.co.jp")) {
    return NextResponse.json(
      { error: "メールアドレスは @adarch.co.jp のものを指定してください（反響の自動トラッキングがこのドメインでのみ動くため）" },
      { status: 400 }
    );
  }

  if (!VALID_TARGET_TYPES.includes(targetType)) {
    return NextResponse.json({ error: "無効なターゲット種別です" }, { status: 400 });
  }

  if (!serviceTypes.every((s: AutoSalesServiceType) => VALID_SERVICE_TYPES.includes(s))) {
    return NextResponse.json({ error: "無効な訴求カテゴリです" }, { status: 400 });
  }

  // 本文は組み立てない。書かれたものをそのまま送る。
  //
  // 以前はここで「【ご提案可能なサービス】＋サービス名の羅列」「ご興味がございましたら〜」
  // 「--- 区切りの署名」を自動で足していた。この定型構造自体が受け手から見て
  // 機械送信の目印になるため廃止した。署名も本人が本文に書く。
  //
  // pitchText には本文と同じものを入れる。プレイブックと成功例の分析が
  // この列を読んでいるので、列自体は残す（分析対象が実際に送った文章になる）。
  const template = await db.autoSalesTemplate.create({
    data: {
      branchId: user.branchId,
      name,
      companyName,
      senderName,
      phone: phone || null,
      email: replyEmail,
      websiteUrl: websiteUrl || null,
      position: position || null,
      department: department || null,
      address: address || null,
      additionalInfo: additionalInfo || null,
      targetType,
      serviceTypes,
      subject: finalSubject,
      pitchText: finalBody,
      body: finalBody,
      scheduledStartDate: scheduledStartDate ? new Date(scheduledStartDate) : null,
      // 申請制：登録＝本部への申請。承認されるまで送信は始まらない。
      isApproved: false,
      submittedAt: new Date(),
    },
  });

  return NextResponse.json(template, { status: 201 });
}
