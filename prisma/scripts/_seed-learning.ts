import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

interface CourseData {
  title: string;
  description: string;
  category: string;
  sortOrder: number;
  lessons: {
    title: string;
    type: string;
    contentUrl?: string;
    durationMin?: number;
    sortOrder: number;
  }[];
  test: {
    title: string;
    passingScore: number;
    maxAttempts: number;
    questions: {
      question: string;
      choices: string[];
      correctIndex: number;
      sortOrder: number;
    }[];
  };
}

const COURSES: CourseData[] = [
  {
    title: "Ad Arch オンボード研修",
    description: "Ad Archグループの基本ルール・業務フロー・ツールの使い方を学びます",
    category: "onboard",
    sortOrder: 0,
    lessons: [
      { title: "Ad Archグループの理念と事業概要", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "業務フローと報告ルール", type: "text", sortOrder: 1, durationMin: 15 },
      { title: "見積・請求システムの使い方", type: "text", sortOrder: 2, durationMin: 20 },
    ],
    test: {
      title: "オンボード理解度テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "Ad Archグループのフランチャイズ加盟後、最初に行うべきことは？",
          choices: ["すぐに営業活動を開始する", "オンボード研修を完了しテストに合格する", "自分でチラシを作成する", "本部に電話して指示を待つ"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "見積書の作成はどのシステムで行いますか？",
          choices: ["Excel", "Ad Arch OS（経営OS）", "Google スプレッドシート", "手書き"],
          correctIndex: 1,
          sortOrder: 1,
        },
        {
          question: "案件の進捗報告はいつ行うべきですか？",
          choices: ["月末にまとめて", "クライアントから聞かれたら", "ステータスが変わるたびに随時", "四半期ごと"],
          correctIndex: 2,
          sortOrder: 2,
        },
        {
          question: "グループ連携依頼とは何ですか？",
          choices: ["本部への苦情", "他拠点と協力して案件を進めるための依頼", "退会申請", "経費精算"],
          correctIndex: 1,
          sortOrder: 3,
        },
        {
          question: "売上報告はどこから行いますか？",
          choices: ["メールで本部に送る", "Chatworkで報告", "Ad Arch OSのダッシュボードから", "LINEグループ"],
          correctIndex: 2,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "TVer広告 取扱研修",
    description: "TVer広告の仕組み・配信設計・入稿ルールを学び、取扱テストに合格すると販売権限が付与されます",
    category: "media",
    sortOrder: 1,
    lessons: [
      { title: "TVer広告とは？ — 媒体概要と強み", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "配信設計とターゲティング", type: "text", sortOrder: 1, durationMin: 15 },
      { title: "入稿規定と審査基準", type: "text", sortOrder: 2, durationMin: 15 },
    ],
    test: {
      title: "TVer広告 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "TVer広告の最大の特徴は？",
          choices: ["紙媒体と連動できる", "完全視聴型でスキップ不可の動画広告", "テレビCMと同じ料金体系", "検索連動型広告"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "TVer広告の主なターゲティング方法として正しいものは？",
          choices: ["年齢・性別・興味関心などのデモグラフィックターゲティング", "電話番号によるターゲティング", "来店履歴のみ", "ターゲティング機能はない"],
          correctIndex: 0,
          sortOrder: 1,
        },
        {
          question: "TVer広告の動画素材として推奨される長さは？",
          choices: ["6秒以内", "15秒または30秒", "60秒以上", "長さの制限はない"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "TVer広告の配信レポートで確認できる指標は？",
          choices: ["視聴完了率・インプレッション数・リーチ数", "来店数のみ", "売上金額", "レポートは提供されない"],
          correctIndex: 0,
          sortOrder: 3,
        },
        {
          question: "TVer広告の入稿時に注意すべき点は？",
          choices: ["どんな素材でも審査なしで配信可能", "放送基準に準拠した審査があり、事前確認が必要", "テキストのみで入稿可能", "入稿締切は配信当日"],
          correctIndex: 1,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "シネアド（イオンシネマ）取扱研修",
    description: "イオンシネマでのシネアド広告の仕組み・料金体系・入稿ルールを学びます",
    category: "media",
    sortOrder: 2,
    lessons: [
      { title: "シネアドとは？ — 映画館広告の特徴", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "イオンシネマの上映枠と料金体系", type: "text", sortOrder: 1, durationMin: 15 },
      { title: "入稿フローと素材規定", type: "text", sortOrder: 2, durationMin: 10 },
    ],
    test: {
      title: "シネアド 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "シネアドの最大の強みは？",
          choices: ["低コストで大量配信", "大画面・高音質の没入環境で強制視聴", "SNSとの連動", "即時配信可能"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "イオンシネマでのシネアド配信単位は？",
          choices: ["全国一斉のみ", "劇場単位で選択可能", "都道府県単位のみ", "配信エリアは選べない"],
          correctIndex: 1,
          sortOrder: 1,
        },
        {
          question: "シネアドの標準的な素材尺は？",
          choices: ["6秒", "15秒・30秒・60秒", "5分", "制限なし"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "シネアドのターゲティングで有効な方法は？",
          choices: ["上映作品のジャンル・劇場の立地で観客層を絞る", "個人のスマホにプッシュ通知", "年収でフィルタリング", "ターゲティングは不可能"],
          correctIndex: 0,
          sortOrder: 3,
        },
        {
          question: "シネアド入稿時の注意点として正しいものは？",
          choices: ["当日入稿OK", "上映開始の数週間前までに素材納品が必要", "口頭で依頼すれば入稿完了", "PDFで入稿"],
          correctIndex: 1,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "タクシー広告 取扱研修",
    description: "タクシーサイネージ広告（タクシーGO等）の仕組み・エリア・料金を学びます",
    category: "media",
    sortOrder: 3,
    lessons: [
      { title: "タクシー広告の概要と市場", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "タクシーGO媒体説明", type: "video", contentUrl: "https://drive.google.com/file/d/1i793kNNZ1Gcue5f6Iz-ub-AaDjmr-_UU/preview", sortOrder: 1, durationMin: 15 },
      { title: "エリア別料金とプラン設計", type: "text", sortOrder: 2, durationMin: 15 },
    ],
    test: {
      title: "タクシー広告 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "タクシーサイネージ広告の主な視聴者は？",
          choices: ["通行人", "乗客（後部座席のビジネスパーソン等）", "運転手", "歩行者"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "タクシー広告のファーストビュー（最初に流れる広告枠）の特徴は？",
          choices: ["料金が安い", "乗車直後に再生され注目度が最も高い", "音声なしで配信される", "30分に1回だけ再生"],
          correctIndex: 1,
          sortOrder: 1,
        },
        {
          question: "タクシー広告のエリア選定で重要なのは？",
          choices: ["全国一律で配信するのが基本", "ターゲット企業やBtoB商圏に合わせてエリアを選ぶ", "地方だけに配信するのが効果的", "エリア選定はできない"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "タクシー広告が特に効果的な業種は？",
          choices: ["BtoB・SaaS・経営者向けサービス", "子供向け玩具", "スーパーの特売", "ネットショップ限定商品"],
          correctIndex: 0,
          sortOrder: 3,
        },
        {
          question: "タクシー広告の素材入稿について正しいものは？",
          choices: ["テキストのみ入稿可能", "動画素材で15秒〜60秒が標準", "音声付き素材は禁止", "手書きイラストを撮影して入稿"],
          correctIndex: 1,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "デジタルサイネージ 取扱研修",
    description: "デジタルサイネージ広告の種類・設置場所・効果測定を学びます",
    category: "media",
    sortOrder: 4,
    lessons: [
      { title: "デジタルサイネージ広告の基礎", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "設置場所と活用シーン", type: "text", sortOrder: 1, durationMin: 15 },
    ],
    test: {
      title: "デジタルサイネージ 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "デジタルサイネージの最大のメリットは？",
          choices: ["一度設置したら変更不可", "時間帯や場所に応じてコンテンツを柔軟に変更できる", "紙より安い", "テレビと同じ"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "デジタルサイネージ広告の主な設置場所は？",
          choices: ["個人宅", "商業施設・駅・病院・オフィスビルなどの公共空間", "飛行機の中のみ", "自動車の中のみ"],
          correctIndex: 1,
          sortOrder: 1,
        },
        {
          question: "デジタルサイネージ広告の効果測定方法として有効なものは？",
          choices: ["目視のみ", "視認数カウント・QRコード誘導・来店計測", "効果測定はできない", "アンケートのみ"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "デジタルサイネージの提案時に重要なポイントは？",
          choices: ["どこでもいいので安い場所を選ぶ", "ターゲットの動線と設置場所のマッチング", "とにかく大きな画面を選ぶ", "音声を最大にする"],
          correctIndex: 1,
          sortOrder: 3,
        },
        {
          question: "デジタルサイネージ広告のコンテンツ制作で注意すべき点は？",
          choices: ["文字を大量に入れる", "視認時間が短いため、シンプルで目を引くデザインにする", "白黒のみ使用する", "アニメーションは禁止"],
          correctIndex: 1,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "アパホテル広告 取扱研修",
    description: "アパホテル客室サイネージ広告の特徴と販売方法を学びます",
    category: "media",
    sortOrder: 5,
    lessons: [
      { title: "アパホテル広告の特徴とリーチ", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "配信メニューと料金体系", type: "text", sortOrder: 1, durationMin: 10 },
    ],
    test: {
      title: "アパホテル広告 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "アパホテル客室サイネージ広告の特徴は？",
          choices: ["屋外看板", "客室テレビで宿泊者に配信される動画広告", "ロビーのポスターのみ", "チラシ配布"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "アパホテル広告のターゲット層として最も適切なのは？",
          choices: ["子供", "ビジネス出張者・観光客", "在宅ワーカー", "学生"],
          correctIndex: 1,
          sortOrder: 1,
        },
        {
          question: "アパホテル広告が効果的なサービスは？",
          choices: ["地元のスーパー特売", "出張・旅行・飲食・交通関連サービス", "農業機械", "学習塾"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "アパホテル広告の配信エリア選定は？",
          choices: ["全国一律のみ", "ホテル所在地（エリア）単位で選択可能", "海外のみ", "選択不可"],
          correctIndex: 1,
          sortOrder: 3,
        },
        {
          question: "アパホテル広告の提案で重要なのは？",
          choices: ["宿泊者の属性と広告主のターゲットの一致", "価格だけで判断", "テキスト広告を推奨", "1秒の広告を提案"],
          correctIndex: 0,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "大学広告 取扱研修",
    description: "大学構内でのデジタルサイネージ・ポスター広告の仕組みを学びます",
    category: "media",
    sortOrder: 6,
    lessons: [
      { title: "大学広告の特徴と媒体種類", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "ターゲティングと提案方法", type: "text", sortOrder: 1, durationMin: 10 },
    ],
    test: {
      title: "大学広告 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "大学広告の最大の強みは？",
          choices: ["高齢者にリーチできる", "18〜22歳の若年層に確実にリーチできる", "全世代に均等にリーチ", "BtoBに強い"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "大学広告で効果的な業種は？",
          choices: ["介護サービス", "就活サービス・アプリ・飲食・エンタメなど若者向けサービス", "重機メーカー", "法人向けSaaS"],
          correctIndex: 1,
          sortOrder: 1,
        },
        {
          question: "大学広告の掲載場所として一般的なのは？",
          choices: ["教授の研究室", "食堂・図書館・掲示板・構内サイネージ", "学長室", "駐車場のみ"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "大学広告の提案で注意すべき点は？",
          choices: ["大学の承認プロセスと掲載期間のスケジュール管理", "学生に直接営業する", "口頭で依頼すればOK", "期間は関係ない"],
          correctIndex: 0,
          sortOrder: 3,
        },
        {
          question: "大学広告のエリア選定で重要なのは？",
          choices: ["偏差値だけで選ぶ", "ターゲット学生の学部・キャンパス所在地を考慮", "大きい大学だけ選ぶ", "選定は不要"],
          correctIndex: 1,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "すかいらーく広告 取扱研修",
    description: "すかいらーくグループ店舗でのテーブルサイネージ広告を学びます",
    category: "media",
    sortOrder: 7,
    lessons: [
      { title: "すかいらーく広告の概要", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "配信メニューとターゲティング", type: "text", sortOrder: 1, durationMin: 10 },
    ],
    test: {
      title: "すかいらーく広告 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "すかいらーく広告の配信場所は？",
          choices: ["テレビCM", "ガスト・バーミヤン等の店舗内テーブルサイネージ", "新聞折込", "Web広告"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "すかいらーく広告の強みは？",
          choices: ["食事中の滞在時間に繰り返し接触できる", "1回しか見られない", "音声のみ", "文字だけ"],
          correctIndex: 0,
          sortOrder: 1,
        },
        {
          question: "すかいらーく広告のターゲット層は？",
          choices: ["経営者のみ", "ファミリー・主婦・シニアなど幅広い層", "10代のみ", "外国人のみ"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "すかいらーく広告が効果的なサービスは？",
          choices: ["BtoB SaaS", "地域密着型サービス・飲食・美容・不動産など生活関連", "宇宙開発", "輸出業"],
          correctIndex: 1,
          sortOrder: 3,
        },
        {
          question: "すかいらーく広告のエリア選定はどう行いますか？",
          choices: ["全店舗一括のみ", "店舗単位・エリア単位で選択可能", "選べない", "都道府県単位のみ"],
          correctIndex: 1,
          sortOrder: 4,
        },
      ],
    },
  },
  {
    title: "ゴルフカート広告 取扱研修",
    description: "ゴルフカート搭載サイネージ広告の特徴と提案方法を学びます",
    category: "media",
    sortOrder: 8,
    lessons: [
      { title: "ゴルフカート広告の概要", type: "text", sortOrder: 0, durationMin: 10 },
      { title: "ターゲット層と提案ポイント", type: "text", sortOrder: 1, durationMin: 10 },
    ],
    test: {
      title: "ゴルフカート広告 取扱テスト",
      passingScore: 80,
      maxAttempts: 3,
      questions: [
        {
          question: "ゴルフカート広告のターゲット層は？",
          choices: ["学生", "経営者・富裕層・ビジネスパーソン", "主婦", "子供"],
          correctIndex: 1,
          sortOrder: 0,
        },
        {
          question: "ゴルフカート広告の特徴は？",
          choices: ["大量配信型", "ラウンド中の約4時間、繰り返し視聴される高接触型", "音声のみ", "1回再生で終了"],
          correctIndex: 1,
          sortOrder: 1,
        },
        {
          question: "ゴルフカート広告が適している商材は？",
          choices: ["子供用おもちゃ", "高級車・金融・不動産・BtoBサービスなど高単価商材", "100円ショップ", "学習教材"],
          correctIndex: 1,
          sortOrder: 2,
        },
        {
          question: "ゴルフカート広告の提案で重要なのは？",
          choices: ["とにかく安さを強調", "ゴルフ場の来場者属性とクライアントのターゲットの一致", "全ゴルフ場に一括配信を推奨", "紙のチラシと併用必須"],
          correctIndex: 1,
          sortOrder: 3,
        },
        {
          question: "ゴルフカート広告の効果測定で有効なのは？",
          choices: ["測定不可", "QRコード・特設URL・来場者アンケート等", "テレビ視聴率", "新聞購読者数"],
          correctIndex: 1,
          sortOrder: 4,
        },
      ],
    },
  },
];

async function main() {
  console.log("Learning seed start...");

  for (const c of COURSES) {
    // 既存チェック（重複防止）
    const existing = await db.learningCourse.findFirst({ where: { title: c.title } });
    if (existing) {
      console.log(`  SKIP: ${c.title} (already exists)`);
      continue;
    }

    const course = await db.learningCourse.create({
      data: {
        title: c.title,
        description: c.description,
        category: c.category,
        sortOrder: c.sortOrder,
        published: true,
        lessons: {
          create: c.lessons.map((l) => ({
            title: l.title,
            type: l.type,
            contentUrl: l.contentUrl ?? null,
            durationMin: l.durationMin ?? null,
            sortOrder: l.sortOrder,
          })),
        },
        tests: {
          create: {
            title: c.test.title,
            passingScore: c.test.passingScore,
            maxAttempts: c.test.maxAttempts,
            questions: {
              create: c.test.questions.map((q) => ({
                question: q.question,
                choices: JSON.stringify(q.choices),
                correctIndex: q.correctIndex,
                sortOrder: q.sortOrder,
              })),
            },
          },
        },
      },
    });
    console.log(`  OK: ${course.title} (${c.lessons.length} lessons, ${c.test.questions.length} questions)`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
