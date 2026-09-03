"use server";

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyCeo } from "@/lib/google-chat";
import { USABILITY_OPTIONS, USED_FOR_OPTIONS } from "./options";

export type FeedbackState = { success?: boolean; error?: string } | null;


// ---------------------------------------------------------------
// ログイン不要。from= で拠点が分かればそれを、無ければ名前欄だけで記録する。
// Googleフォーム（2026-09）と同じ4問。本部にはCEOアラートChatで1通。
// ---------------------------------------------------------------
export async function submitPackageFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  try {
    const slug = String(formData.get("slug") ?? "");
    const from = String(formData.get("from") ?? "").trim();
    const senderName = String(formData.get("senderName") ?? "").trim().slice(0, 80);
    const usability = String(formData.get("usability") ?? "");
    const usedFor = formData
      .getAll("usedFor")
      .map((v) => String(v).trim())
      .filter((v) => (USED_FOR_OPTIONS as readonly string[]).includes(v))
      .slice(0, 10);
    const body = String(formData.get("body") ?? "").trim().slice(0, 4000);

    if (!slug) return { error: "無効なリンクです" };
    if (!senderName) return { error: "お名前（拠点）を入力してください" };
    if (!(USABILITY_OPTIONS as readonly string[]).includes(usability)) return { error: "「使ってみてどうでしたか」を選んでください" };
    if (usedFor.length === 0) return { error: "何に使ったかを1つ以上選んでください" };

    const pkg = await db.salesPackage.findUnique({ where: { slug }, select: { id: true, name: true } });
    if (!pkg) return { error: "パッケージが見つかりません" };

    const company = from
      ? await db.groupCompany.findFirst({ where: { id: from, isActive: true }, select: { id: true, name: true } })
      : null;

    await db.packageFeedback.create({
      data: { packageId: pkg.id, groupCompanyId: company?.id ?? null, senderName, usedFor, usability, body: body || null },
    });

    logAudit({
      action: "package_feedback_submitted",
      email: "form@feedback",
      name: company?.name ?? senderName,
      entity: "package_feedback",
      detail: `${pkg.name} / ${usability} / ${usedFor.join(",")}`,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    notifyCeo(
      `📝 *パッケージのフィードバック* — ${pkg.name}\n` +
        `${senderName}${company ? `（${company.name}）` : ""}／${usability}／${usedFor.join("・")}\n\n` +
        (body ? `${body}\n\n` : "") +
        (appUrl ? `👉 ${appUrl}/dashboard/packages/${slug}#feedback` : "")
    ).catch((e) => console.error("[feedback] notifyCeo error:", e));

    return { success: true };
  } catch (e) {
    console.error("[feedback] Error:", e);
    return { error: "送信に失敗しました。しばらくしてからもう一度お試しください。" };
  }
}
