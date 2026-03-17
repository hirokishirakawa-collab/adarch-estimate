import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.log("No admin user found");
    return;
  }

  // 既存のデモを削除
  await db.proposal.deleteMany({ where: { slug: "demo-preview" } });

  const content = {
    cover: {
      title: "映像×デジタル広告による\n地域ブランディング戦略",
      subtitle: "御社の魅力を、映像の力で全国へ届ける",
      date: "2026年3月18日",
      to: "株式会社サンプルコーポレーション 御中",
    },
    companyIntro: {
      heading: "私たちについて",
      description:
        "アドアーチグループは、全国26拠点のネットワークを持つ映像制作・広告プロダクションです。TVer広告の正規代理店として、地域企業の映像制作からデジタル広告配信までワンストップで支援。大手クライアント（バンダイナムコ様等）の実績と、地域密着の機動力を兼ね備えています。",
      strengths: [
        "TVer広告 正規代理店",
        "全国26拠点ネットワーク",
        "大手〜地域 500件以上の制作実績",
      ],
    },
    proposal: {
      heading: "ご提案",
      challenge:
        "御社のブランド認知は地域内にとどまっており、TVCMでは費用対効果が見えにくい状況です。ターゲット層（20-40代）へのリーチとブランド想起の向上が課題と認識しています。",
      solutions: [
        {
          title: "ブランドムービー制作（90秒）",
          description:
            "御社の世界観・ストーリーを凝縮したブランドムービーを制作。企業サイト・SNS・広告素材として多面的に活用できる映像資産を構築します。",
        },
        {
          title: "TVer広告配信（エリアターゲティング）",
          description:
            "制作した映像をTVer広告として配信。御社の商圏に絞ったエリアターゲティングで、TVCMの1/10のコストで同等以上のリーチを実現します。",
        },
        {
          title: "SNSショート動画展開（月4本）",
          description:
            "ブランドムービーの素材を活用し、Instagram Reels・TikTok向けのショート動画を月4本制作。継続的な認知拡大とエンゲージメント向上を図ります。",
        },
      ],
    },
    cases: {
      heading: "実績・事例",
      items: [
        {
          title: "地方観光協会様 — ブランドムービー＋TVer広告",
          description:
            "90秒のブランドムービーを制作し、TVer広告で県外配信。3ヶ月で動画再生数120万回、観光サイトへの流入が前年比340%に増加。",
        },
        {
          title: "老舗和菓子メーカー様 — SNS動画マーケティング",
          description:
            "月8本のショート動画を6ヶ月間制作。Instagramフォロワーが2,000→18,000に成長し、EC売上が2.4倍に。",
        },
        {
          title: "バンダイナムコエンターテインメント様 — 海外向けCR制作",
          description:
            "ONE PIECEシリーズの海外向けクリエイティブを複数タイトルで制作。多言語・多フォーマット展開のノウハウを蓄積。",
        },
      ],
    },
    nextSteps: {
      heading: "今後の進め方",
      steps: [
        "お打ち合わせ（ヒアリング・ご要望確認）— 1週間以内",
        "企画書・お見積もりのご提出 — 2週間以内",
        "制作キックオフ — ご発注後1週間",
        "初稿ご確認・フィードバック — 制作開始から3週間",
        "最終納品・広告配信開始 — 制作開始から5週間",
      ],
      contact:
        "ご不明点やご要望がございましたら、お気軽にご連絡ください。\n担当: 白川 | hiroki.shirakawa@adarch.co.jp",
    },
  };

  const proposal = await db.proposal.create({
    data: {
      userId: admin.id,
      companyName: "株式会社サンプルコーポレーション",
      industry: "other",
      challenge: "ブランド認知の拡大",
      content,
      slug: "demo-preview",
      isPublished: true,
      publishedAt: new Date(),
      title: "映像×デジタル広告による地域ブランディング戦略",
    },
  });

  console.log("Created:", proposal.id);
  console.log("URL: http://localhost:3001/p/demo-preview");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
