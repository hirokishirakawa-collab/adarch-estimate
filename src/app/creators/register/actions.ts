"use server";

import { db as prisma } from "@/lib/db";
import { createHash } from "crypto";
import { headers } from "next/headers";

type RegisterResult = {
  success: boolean;
  error?: string;
  creatorId?: string;
};

export async function registerCreator(
  formData: FormData
): Promise<RegisterResult> {
  try {
    const name = formData.get("name") as string;
    const nameKana = formData.get("nameKana") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const prefecture = formData.get("prefecture") as string;
    const city = formData.get("city") as string;
    const companyName = formData.get("companyName") as string;
    const website = formData.get("website") as string;
    const bio = formData.get("bio") as string;
    const yearsOfExp = parseInt(formData.get("yearsOfExp") as string) || null;
    const dayRate = parseInt(formData.get("dayRate") as string) || null;
    const halfDayRate = parseInt(formData.get("halfDayRate") as string) || null;
    const availability =
      parseInt(formData.get("availability") as string) || null;
    const equipment = formData.get("equipment") as string;
    const entityType = (formData.get("entityType") as string) || "individual";
    const hasBusinessRegistration = formData.get("hasBusinessRegistration") === "yes";
    const ndaAgreed = formData.get("ndaAgreed") === "true";

    // スキル: "cat_shooting:ADVANCED,cat_editing:EXPERT" 形式
    const skillsRaw = formData.get("skills") as string;
    // スキル補足: "cat_shooting:RED KOMODO使用,cat_editing:Premiere Pro" 形式
    const skillNotesRaw = formData.get("skillNotes") as string;
    // ポートフォリオ: JSON配列 [{"url":"...","title":"..."}]
    const portfoliosRaw = formData.get("portfolios") as string;

    // バリデーション
    if (!name || !email || !prefecture) {
      return { success: false, error: "必須項目が入力されていません" };
    }
    if (!ndaAgreed) {
      return {
        success: false,
        error: "守秘義務契約への同意が必要です",
      };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "メールアドレスの形式が正しくありません" };
    }

    // 重複チェック
    const existing = await prisma.creator.findUnique({ where: { email } });
    if (existing) {
      return {
        success: false,
        error: "このメールアドレスは既に登録されています",
      };
    }

    // NDAデジタル署名
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = headersList.get("user-agent") || "";
    const now = new Date().toISOString();
    const signatureHash = createHash("sha256")
      .update(`${name}|${email}|${now}`)
      .digest("hex");

    // トランザクションで一括作成
    const creator = await prisma.$transaction(async (tx) => {
      const c = await tx.creator.create({
        data: {
          name,
          nameKana: nameKana || null,
          email,
          entityType,
          hasBusinessRegistration,
          phone: phone || null,
          prefecture,
          city: city || null,
          companyName: companyName || null,
          website: website || null,
          bio: bio || null,
          yearsOfExp,
          dayRate,
          halfDayRate,
          availability,
          equipment: equipment || null,
        },
      });

      // スキル登録
      if (skillsRaw) {
        const skillNotes = new Map<string, string>();
        if (skillNotesRaw) {
          for (const pair of skillNotesRaw.split(",")) {
            const [catId, note] = pair.split(":");
            if (catId && note) skillNotes.set(catId, note);
          }
        }

        const skills = skillsRaw.split(",").filter(Boolean);
        for (const skill of skills) {
          const [categoryId, level] = skill.split(":");
          if (!categoryId || !level) continue;
          await tx.creatorSkill.create({
            data: {
              creatorId: c.id,
              categoryId,
              level: level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT",
              note: skillNotes.get(categoryId) || null,
            },
          });
        }
      }

      // ポートフォリオ登録
      if (portfoliosRaw) {
        try {
          const portfolios = JSON.parse(portfoliosRaw) as {
            url: string;
            title: string;
          }[];
          for (let i = 0; i < portfolios.length; i++) {
            const p = portfolios[i];
            if (!p.url) continue;
            await tx.creatorPortfolio.create({
              data: {
                creatorId: c.id,
                url: p.url,
                title: p.title || null,
                order: i,
              },
            });
          }
        } catch {
          // ポートフォリオのパースエラーは無視
        }
      }

      // NDA登録
      await tx.creatorNda.create({
        data: {
          creatorId: c.id,
          ipAddress: ip,
          userAgent: ua,
          signatureHash,
        },
      });

      // 自動分析用レコード（pending状態で作成、バックグラウンドで処理）
      if (website) {
        await tx.creatorAnalysis.create({
          data: {
            creatorId: c.id,
            scrapeStatus: "pending",
          },
        });
      }

      return c;
    });

    return { success: true, creatorId: creator.id };
  } catch (e) {
    console.error("Creator registration error:", e);
    return { success: false, error: "登録中にエラーが発生しました" };
  }
}
