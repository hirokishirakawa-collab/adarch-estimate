import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/admin/seed-wiki — ヘルプガイド記事を一括作成（ADMIN限定・一回限り）
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tag = await db.wikiTag.upsert({
    where: { name: "ヘルプガイド" },
    update: {},
    create: { name: "ヘルプガイド", color: "#c8aa64" },
  });

  const updateTag = await db.wikiTag.upsert({
    where: { name: "2026年3月更新" },
    update: {},
    create: { name: "2026年3月更新", color: "#3b82f6" },
  });

  const articles = [
    {
      title: "【新機能】通知センターの使い方",
      body: "## 通知センター\n\nヘッダー右上のベルアイコンから、OS内の通知を確認できます。\n\n### 通知される内容\n- 商談のステータス変更（受注・失注等）\n- 提案書が閲覧された時\n- 月次報告の提出\n- プロジェクトの自動作成\n- システム通知\n\n### 使い方\n1. ヘッダーのベルアイコンをクリック\n2. 未読通知は赤いバッジで件数表示\n3. 通知をクリックすると該当ページに遷移\n4. 「すべて既読」で一括既読\n\n通知は60秒ごとに自動更新されます。",
    },
    {
      title: "【新機能】商談→プロジェクト自動遷移",
      body: "## 商談の受注 → プロジェクト自動作成\n\n商談を「受注」ステータスに変更すると、自動的にプロジェクトが作成されます。\n\n### 動作\n1. 商談管理（SFA）で商談を「受注」にドラッグ、またはフォームで受注に変更\n2. 自動的にプロジェクトが作成されます\n3. 商談詳細ページにプロジェクトへのリンクが表示されます\n\n### 自動で引き継がれる情報\n- プロジェクト名（商談タイトル）\n- 予算（商談金額）\n- 顧客情報\n- 担当者\n- 拠点\n\n手動でプロジェクトを作成する必要はもうありません。",
    },
    {
      title: "【新機能】お気に入り（ピン留め）",
      body: "## ページのピン留め機能\n\nよく使うページをサイドバーの上部にピン留めできます。\n\n### ピン留めの方法\n1. 各ページのタイトル横にある ★ アイコンをクリック\n2. サイドバーの「ピン留め」セクションに追加されます\n3. もう一度 ★ をクリックで解除\n\n### 対応ページ\n- 顧客管理\n- 商談管理\n- 公式見積もり\n- プロジェクト管理\n- リード管理\n\n最大5ページまでピン留め可能です。",
    },
    {
      title: "【新機能】一括操作（顧客・リード）",
      body: "## 一括操作\n\n顧客一覧・リード一覧でチェックボックスを使って複数件を同時に操作できます。\n\n### 顧客の一括操作\n1. 顧客一覧でチェックボックスを選択\n2. 画面下部に操作バーが表示\n3. 操作: ステータス一括変更（見込み/アクティブ/休止/停止）\n4. ADMIN: 一括削除も可能\n\n### リードの一括操作\n1. リード一覧でチェックボックスを選択\n2. 操作: ステータス一括変更 / 担当者一括割当\n3. ADMIN: 一括削除も可能\n\n全選択/選択解除もワンクリックで可能です。",
    },
    {
      title: "【新機能】操作ログ（詳細）— ADMIN専用",
      body: "## 操作ログ詳細ビュー\n\n管理者メニュー →「操作ログ（詳細）」から、OS内の全操作を確認できます。\n\n### 確認できる内容\n- ログイン成功/失敗\n- 不正アクセス試行\n- レートリミット超過\n- ユーザーロール変更\n- アカウント停止/復活\n- メンバー登録\n- 機能許可の変更\n\n### フィルタ機能\n- アクション種別で絞り込み\n- メールアドレスで検索\n- ページネーション（100件ずつ）\n\nセキュリティインシデントの早期発見に活用してください。",
    },
    {
      title: "月次報告とアカウント管理",
      body: "## 月次報告の提出ルール\n\n毎月の月次報告は、アカウントの継続利用に必要です。\n\n### スケジュール\n- **毎月25日〜**: サイドバーに黄色の警告バナー表示\n- **毎月28日〜**: 赤い警告バナーに変化（停止予告）\n- **翌月1日**: 未提出の場合、自動でアカウント停止\n\n### 停止された場合\n1. ログインするとそのまま月次報告ページに遷移します\n2. 前月分の報告がデフォルトで選択されています\n3. 報告を提出すると自動的にアカウントが復活します\n\n### 報告の内容\n- 報告月\n- 今の状況（稼働状況）\n- 今月の案件数・来月の見込み\n- 売上金額（税抜）\n- 本部への相談事項\n\n**売上が0円の月も報告は必要です。**",
    },
    {
      title: "セキュリティとAPI利用制限",
      body: "## セキュリティ対策\n\nAd-Arch Group OSでは以下のセキュリティ対策を実施しています。\n\n### AI機能のレートリミット\n- 1分間: 5回/エンドポイント\n- 1日: 200回/エンドポイント\n- ユーザー1日合計: 30回\n- システム全体1日: 200回\n\n上限に達すると「リクエスト回数の制限に達しました」と表示されます。翌日にリセットされます。\n\n### アクセス制御\n- **ADMIN**: 全機能・全データにアクセス可能\n- **MANAGER**: 自拠点のデータのみ、財務閲覧可\n- **USER**: 自拠点の実務ツールのみ\n\n### データ保護\n- 提案書・商談データは自拠点のもののみ表示\n- 名刺の機密情報は開示申請が必要\n- 全操作が監査ログに記録されます",
    },
  ];

  const branchHq = await db.branch.findFirst();
  if (!branchHq) return NextResponse.json({ error: "No branch found" }, { status: 500 });

  const results: string[] = [];
  for (const article of articles) {
    const existing = await db.wikiArticle.findFirst({ where: { title: article.title } });
    if (existing) {
      await db.wikiArticle.update({
        where: { id: existing.id },
        data: { body: article.body, tags: { set: [{ id: tag.id }, { id: updateTag.id }] } },
      });
      results.push(`Updated: ${article.title}`);
    } else {
      await db.wikiArticle.create({
        data: {
          title: article.title,
          body: article.body,
          authorName: "システム",
          branchId: branchHq.id,
          tags: { connect: [{ id: tag.id }, { id: updateTag.id }] },
        },
      });
      results.push(`Created: ${article.title}`);
    }
  }

  return NextResponse.json({ results });
}
