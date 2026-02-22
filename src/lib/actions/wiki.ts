"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMockBranchId } from "@/lib/data/customers";
import type { UserRole } from "@/types/roles";

// ---------------------------------------------------------------
// 共通ユーティリティ
// ---------------------------------------------------------------
async function getSessionInfo() {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user.role ?? "MANAGER") as UserRole;
  const email = session.user.email ?? "";
  const name = session.user.name ?? session.user.email ?? "不明";
  const branchId = getMockBranchId(email, role) ?? "branch_hq";
  return { role, email, name, branchId };
}

// ---------------------------------------------------------------
// Wiki記事を作成する
// ---------------------------------------------------------------
export async function createArticle(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };
  const { name, branchId } = info;

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "タイトルは必須です" };
  if (title.length > 200) return { error: "タイトルは200文字以内で入力してください" };

  const body = (formData.get("body") as string)?.trim();
  if (!body) return { error: "本文は必須です" };

  let articleId: string;
  try {
    const article = await db.wikiArticle.create({
      data: { title, body, authorName: name, branchId },
    });
    articleId = article.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createArticle] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `保存失敗: ${msg}` : "保存に失敗しました" };
  }

  revalidatePath("/dashboard/wiki");
  redirect(`/dashboard/wiki/${articleId}`);
}

// ---------------------------------------------------------------
// Wiki記事を更新する
// ---------------------------------------------------------------
export async function updateArticle(
  articleId: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const info = await getSessionInfo();
  if (!info) return { error: "ログインが必要です" };

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "タイトルは必須です" };
  if (title.length > 200) return { error: "タイトルは200文字以内で入力してください" };

  const body = (formData.get("body") as string)?.trim();
  if (!body) return { error: "本文は必須です" };

  try {
    await db.wikiArticle.update({
      where: { id: articleId },
      data: { title, body },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[updateArticle] DB error:", msg);
    return { error: process.env.NODE_ENV !== "production" ? `保存失敗: ${msg}` : "保存に失敗しました" };
  }

  revalidatePath("/dashboard/wiki");
  revalidatePath(`/dashboard/wiki/${articleId}`);
  redirect(`/dashboard/wiki/${articleId}`);
}

// ---------------------------------------------------------------
// Wiki記事を削除する
// ---------------------------------------------------------------
export async function deleteArticle(articleId: string): Promise<void> {
  const info = await getSessionInfo();
  if (!info) return;

  try {
    await db.wikiArticle.delete({ where: { id: articleId } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[deleteArticle] DB error:", msg);
    return;
  }

  revalidatePath("/dashboard/wiki");
  redirect("/dashboard/wiki");
}
