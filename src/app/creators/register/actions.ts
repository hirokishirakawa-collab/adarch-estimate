"use server";

import { db as prisma } from "@/lib/db";
import { createHash, randomInt } from "crypto";
import { headers } from "next/headers";
import {
  sendCreatorWelcomeEmail,
  sendCreatorRegistrationNotifyEmail,
  sendCreatorVerificationEmail,
} from "@/lib/resend";
import { uploadCreatorAvatar } from "@/lib/storage";

type RegisterResult = {
  success: boolean;
  error?: string;
  creatorId?: string;
};

type VerifyResult = {
  success: boolean;
  error?: string;
};

// ----------------------------------------------------------------
// Step 1: メール認証コード送信
// ----------------------------------------------------------------
export async function sendVerificationCode(
  email: string,
  name: string
): Promise<VerifyResult> {
  try {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "メールアドレスの形式が正しくありません" };
    }

    // 既存登録チェック
    const existing = await prisma.creator.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      return { success: false, error: "このメールアドレスは既に登録されています" };
    }

    // 6桁コード生成
    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分

    // 未認証の仮レコードがあれば更新、なければ作成
    if (existing) {
      await prisma.creator.update({
        where: { email },
        data: { otpCode: code, otpExpiresAt: expiresAt, name },
      });
    } else {
      await prisma.creator.create({
        data: {
          email,
          name,
          prefecture: "未設定",
          otpCode: code,
          otpExpiresAt: expiresAt,
          emailVerified: false,
        },
      });
    }

    // メール送信
    await sendCreatorVerificationEmail({ to: email, name, code });

    return { success: true };
  } catch (e) {
    console.error("Send verification code error:", e);
    return { success: false, error: "認証コードの送信に失敗しました" };
  }
}

// ----------------------------------------------------------------
// Step 2: メール認証コード検証
// ----------------------------------------------------------------
export async function verifyCode(
  email: string,
  code: string
): Promise<VerifyResult> {
  try {
    const creator = await prisma.creator.findUnique({ where: { email } });
    if (!creator) {
      return { success: false, error: "登録情報が見つかりません" };
    }
    if (!creator.otpCode || !creator.otpExpiresAt) {
      return { success: false, error: "認証コードが発行されていません" };
    }
    if (new Date() > creator.otpExpiresAt) {
      return { success: false, error: "認証コードの有効期限が切れています。再送信してください" };
    }
    if (creator.otpCode !== code) {
      return { success: false, error: "認証コードが正しくありません" };
    }

    await prisma.creator.update({
      where: { email },
      data: { emailVerified: true, otpCode: null, otpExpiresAt: null },
    });

    return { success: true };
  } catch (e) {
    console.error("Verify code error:", e);
    return { success: false, error: "認証に失敗しました" };
  }
}

// ----------------------------------------------------------------
// Step 3: 本登録（メール認証済みの状態で呼ばれる）
// ----------------------------------------------------------------
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
    const interestedInPartnership = formData.get("interestedInPartnership") === "true";
    const ndaAgreed = formData.get("ndaAgreed") === "true";

    const avatarFile = formData.get("avatar") as File | null;
    const skillsRaw = formData.get("skills") as string;
    const skillNotesRaw = formData.get("skillNotes") as string;
    const portfoliosRaw = formData.get("portfolios") as string;

    // バリデーション
    if (!name || !email || !prefecture) {
      return { success: false, error: "必須項目が入力されていません" };
    }
    if (!ndaAgreed) {
      return { success: false, error: "守秘義務契約への同意が必要です" };
    }

    // メール認証済みか確認
    const existing = await prisma.creator.findUnique({ where: { email } });
    if (!existing || !existing.emailVerified) {
      return { success: false, error: "メール認証が完了していません" };
    }

    // アバター画像アップロード（任意）
    let profileImageUrl: string | null = null;
    if (avatarFile && avatarFile.size > 0) {
      profileImageUrl = await uploadCreatorAvatar(avatarFile);
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

    // 既存の仮レコードを本登録に更新 + 関連データ作成
    const creator = await prisma.$transaction(async (tx) => {
      const c = await tx.creator.update({
        where: { email },
        data: {
          name,
          nameKana: nameKana || null,
          entityType,
          hasBusinessRegistration,
          interestedInPartnership,
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
          ...(profileImageUrl ? { profileImage: profileImageUrl } : {}),
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

      // 自動分析用レコード
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

    // スキル名を取得（メール用）
    const skillNames = skillsRaw
      ? await Promise.all(
          skillsRaw.split(",").filter(Boolean).map(async (s) => {
            const catId = s.split(":")[0];
            const cat = await prisma.skillCategory.findUnique({ where: { id: catId } });
            return cat?.name || catId;
          })
        )
      : [];

    // メール送信（非同期）
    sendCreatorWelcomeEmail({
      to: email,
      name,
      skills: skillNames,
      prefecture,
    }).catch((e) => console.error("Welcome email error:", e));

    sendCreatorRegistrationNotifyEmail({
      name,
      email,
      prefecture,
      entityType,
      skills: skillNames,
      dayRate: dayRate ? parseInt(String(dayRate)) : null,
      website: website || null,
      creatorId: creator.id,
    }).catch((e) => console.error("Notify email error:", e));

    return { success: true, creatorId: creator.id };
  } catch (e) {
    console.error("Creator registration error:", e);
    return { success: false, error: "登録中にエラーが発生しました" };
  }
}
