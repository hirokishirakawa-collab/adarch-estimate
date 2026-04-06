"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerCreator, sendVerificationCode, verifyCode } from "./actions";

// 都道府県リスト
const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const SKILL_CATEGORIES = [
  { id: "cat_shooting", name: "撮影（カメラマン）", icon: "🎬" },
  { id: "cat_editing", name: "編集（エディター）", icon: "✂️" },
  { id: "cat_motion", name: "モーショングラフィックス", icon: "💫" },
  { id: "cat_color", name: "カラーグレーディング", icon: "🎨" },
  { id: "cat_drone", name: "ドローン撮影", icon: "🚁" },
  { id: "cat_audio", name: "音声収録・MA", icon: "🎙️" },
  { id: "cat_narration", name: "ナレーション", icon: "🗣️" },
  { id: "cat_direction", name: "ディレクション", icon: "📋" },
  { id: "cat_planning", name: "企画・脚本", icon: "📝" },
  { id: "cat_3dcg", name: "3DCG・VFX", icon: "🌐" },
];

const SKILL_LEVELS = [
  { value: "BEGINNER", label: "初級", desc: "基礎的な業務が可能" },
  { value: "INTERMEDIATE", label: "中級", desc: "一般的な案件を独力で遂行" },
  { value: "ADVANCED", label: "上級", desc: "高品質な成果物を安定提供" },
  { value: "EXPERT", label: "エキスパート", desc: "業界トップクラスの実力" },
];

type SkillEntry = { categoryId: string; level: string; note: string };
type PortfolioEntry = { url: string; title: string };

export default function CreatorRegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [agreed, setAgreed] = useState(false); // 事前同意
  const [emailVerified, setEmailVerified] = useState(false); // メール認証済み
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  // Step 1: 基本情報
  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [yearsOfExp, setYearsOfExp] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [halfDayRate, setHalfDayRate] = useState("");
  const [availability, setAvailability] = useState("");
  const [equipment, setEquipment] = useState("");
  const [entityType, setEntityType] = useState<"individual" | "corporation">("individual");
  const [hasBusinessRegistration, setHasBusinessRegistration] = useState<"yes" | "no" | "">("");
  const [interestedInPartnership, setInterestedInPartnership] = useState(false);

  // Step 2: スキル
  const [skills, setSkills] = useState<SkillEntry[]>([]);

  // Step 3: ポートフォリオ
  const [portfolios, setPortfolios] = useState<PortfolioEntry[]>([
    { url: "", title: "" },
  ]);

  // Step 4: NDA
  const [ndaAgreed, setNdaAgreed] = useState(false);

  const toggleSkill = (categoryId: string) => {
    setSkills((prev) => {
      const exists = prev.find((s) => s.categoryId === categoryId);
      if (exists) return prev.filter((s) => s.categoryId !== categoryId);
      return [...prev, { categoryId, level: "INTERMEDIATE", note: "" }];
    });
  };

  const updateSkillLevel = (categoryId: string, level: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.categoryId === categoryId ? { ...s, level } : s))
    );
  };

  const updateSkillNote = (categoryId: string, note: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.categoryId === categoryId ? { ...s, note } : s))
    );
  };

  const addPortfolio = () => {
    setPortfolios((prev) => [...prev, { url: "", title: "" }]);
  };

  const removePortfolio = (index: number) => {
    setPortfolios((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePortfolio = (
    index: number,
    field: "url" | "title",
    value: string
  ) => {
    setPortfolios((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const validateStep = (s: number): boolean => {
    setError("");
    if (s === 1) {
      if (!name) { setError("氏名を入力してください"); return false; }
      if (!email) { setError("メールアドレスを入力してください"); return false; }
      if (!emailVerified) { setError("メール認証を完了してください"); return false; }
      if (!prefecture) { setError("活動拠点を選択してください"); return false; }
    }
    if (s === 2 && skills.length === 0) {
      setError("スキルを1つ以上選択してください");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = () => {
    if (!ndaAgreed) {
      setError("守秘義務契約への同意が必要です");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("nameKana", nameKana);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("prefecture", prefecture);
    formData.set("city", city);
    formData.set("companyName", companyName);
    formData.set("website", website);
    formData.set("bio", bio);
    formData.set("yearsOfExp", yearsOfExp);
    formData.set("dayRate", dayRate);
    formData.set("halfDayRate", halfDayRate);
    formData.set("availability", availability);
    formData.set("equipment", equipment);
    formData.set("entityType", entityType);
    formData.set("hasBusinessRegistration", hasBusinessRegistration);
    formData.set("interestedInPartnership", interestedInPartnership ? "true" : "false");
    formData.set("ndaAgreed", "true");

    const skillsStr = skills
      .map((s) => `${s.categoryId}:${s.level}`)
      .join(",");
    formData.set("skills", skillsStr);

    const skillNotesStr = skills
      .filter((s) => s.note)
      .map((s) => `${s.categoryId}:${s.note}`)
      .join(",");
    formData.set("skillNotes", skillNotesStr);

    const validPortfolios = portfolios.filter((p) => p.url);
    formData.set("portfolios", JSON.stringify(validPortfolios));

    startTransition(async () => {
      const result = await registerCreator(formData);
      if (result.success) {
        const completeUrl = interestedInPartnership
          ? "/creators/register/complete?partnership=1"
          : "/creators/register/complete";
        router.push(completeUrl);
      } else {
        setError(result.error || "登録に失敗しました");
      }
    });
  };

  // ===== 事前同意画面 =====
  if (!agreed) {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-4">
          <div className="text-center mb-8">
            <span className="text-sm tracking-widest text-white/40 font-bold">
              AD ARCH GROUP
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold mt-4 mb-3">
              クリエイター登録にあたって
            </h1>
            <p className="text-white/40 text-sm">
              ご登録の前に、以下の内容をご確認ください
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">

            {/* サービス概要 */}
            <div>
              <h2 className="font-bold text-base mb-3">本サービスについて</h2>
              <p className="text-sm text-white/60 leading-relaxed">
                Ad Arch Creator Network（以下「本サービス」）は、Ad Arch株式会社（以下「当社」）が運営する
                映像クリエイター向けのプロジェクトマッチングプラットフォームです。
                ご登録いただくことで、当社グループのプロジェクト案件のご相談をお受けいただける機会を提供いたします。
              </p>
            </div>

            {/* 利用資格 */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">ご利用にあたって</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  本サービスへの登録は無料です。登録に伴う費用は一切発生しません。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  登録は18歳以上の方を対象としています。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  法人・個人いずれの方もご登録いただけます。個人の方は開業届の届出を推奨しております。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  ご登録後、スキルや経験の確認のためTV会議での面談をお願いする場合があります。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  プロジェクトの相談は、登録内容に基づきマッチングを行った上でメールにてご連絡いたします。
                  なお、登録をもって案件のご紹介を保証するものではありません。
                </li>
              </ul>
            </div>

            {/* 情報の取り扱い */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">ご登録情報の取り扱い</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  ご登録いただいた氏名・連絡先は、プロジェクトのご相談連絡およびサービスに関するご案内にのみ使用いたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  スキル・経験年数・活動エリア・単価・機材等の情報は、プロジェクトへの最適なマッチングのために活用いたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  WebサイトURLをご登録いただいた場合、掲載されている制作実績の内容を確認し、
                  スキルや得意ジャンルの把握に利用することがあります。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  ご登録情報をもとに、サービス品質向上を目的として統計的な集計・分析を行うことがあります。
                  この場合、個人を特定できない形で処理されます。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  ご登録情報を本サービスの運営目的以外で第三者に提供することはありません。
                  ただし、法令に基づく場合はこの限りではありません。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  登録情報はマイページからいつでも変更・削除が可能です。退会を希望される場合はお問い合わせください。
                </li>
              </ul>
            </div>

            {/* 守秘義務・制作物の取り扱い */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">守秘義務・秘密保持について</h2>
              <p className="text-sm text-white/50 mb-3 leading-relaxed">
                当社がご紹介するプロジェクトには、クライアントの機密情報が多数含まれます。
                以下の秘密保持に関する事項は、登録者に厳格に遵守いただく必要があります。
              </p>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  登録完了時に、当社との守秘義務契約（NDA）が締結されます。詳細は登録最終ステップでご確認いただけます。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  当社を通じて知り得たすべての情報（クライアント名・企画内容・予算・スケジュール・制作物の内容・
                  撮影場所・出演者情報・未公開素材等）は、秘密情報として厳格に取り扱っていただきます。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  秘密情報は、SNS・ブログ・口頭での会話を含むあらゆる手段において第三者に開示・漏洩してはなりません。
                  「匿名」「ぼかし」での言及も禁止です。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  プロジェクトへの参加事実そのもの（「○○社の案件に参加した」等）も秘密情報に含まれます。
                  参加の有無を含め、一切の公表を禁止いたします。
                </li>
              </ul>
            </div>

            {/* 制作物・実績の利用制限 */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">制作物・実績の利用制限</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  当社グループの案件で制作された映像・写真・音声・グラフィック等のすべての制作物に関する
                  著作権・利用権は、原則として当社またはクライアントに帰属します。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  制作物および制作に参加した実績を、ご自身のポートフォリオ・Webサイト・SNS・
                  営業資料・デモリール等で使用することは一切できません。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  公開済みの制作物であっても、「自身が制作に関わった」旨の公表は、
                  当社の書面による事前承諾がない限り禁止です。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  撮影現場で取得した素材（カット・テイク・メイキング映像等）を個人的に保持・複製・転送することは禁止です。
                  プロジェクト完了後は速やかにデータを削除してください。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  上記に違反した場合、アカウントの即時停止および損害賠償の請求対象となります。
                </li>
              </ul>
            </div>

            {/* 秘密保持の有効期間 */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">秘密保持の有効期間</h2>
              <p className="text-sm text-white/60 leading-relaxed">
                守秘義務は、本サービスへの登録期間中はもちろん、退会後も5年間にわたって効力を有します。
                プロジェクトごとに別途NDAが締結された場合は、より長い期間が適用されることがあります。
              </p>
            </div>

            {/* コミュニケーション */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">ご連絡・通知について</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  プロジェクト相談のご連絡は、ご登録いただいたメールアドレス宛にお送りいたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  サービスの重要な変更やメンテナンス情報について、メールでお知らせする場合があります。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  プロジェクト相談への応諾・辞退は任意です。辞退された場合でも不利益は生じません。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  ご活躍状況やスキルに応じて、当社グループへのパートナー参加（加盟）に関するご案内を
                  お送りする場合があります。こちらも任意であり、強制ではありません。
                </li>
              </ul>
            </div>

            {/* 報酬・支払い */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">報酬・お支払いについて</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  報酬金額はプロジェクトごとに個別にご相談の上、双方の合意をもって決定いたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  お支払いは月末締め・翌々月10日払いです。納品完了後に請求書をご提出いただき、指定口座へお振込みいたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  個人の方への報酬については、源泉徴収税を差し引いた金額でのお支払いとなります。
                  年間の支払調書は翌年1月にお送りいたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  交通費・機材レンタル費等の実費精算が発生する場合は、事前にお見積りの上、
                  報酬とあわせてお支払いいたします。
                </li>
              </ul>
            </div>

            {/* キャンセル */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">キャンセルについて</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  プロジェクトの相談段階では、応諾・辞退は自由です。辞退による不利益は一切ありません。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  案件確定後（発注書・契約書締結後）のキャンセルについては、
                  撮影日の7営業日前までにお申し出ください。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  確定後の直前キャンセルや無断キャンセルが発生した場合、
                  今後のプロジェクト紹介をお控えさせていただく場合があります。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  天災・交通障害等のやむを得ない事由によるキャンセルについては、
                  双方協議の上対応いたします。
                </li>
              </ul>
            </div>

            {/* 現場・保険 */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">撮影現場・保険について</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  撮影現場での安全管理には十分ご配慮をお願いいたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  ご自身の機材の破損・紛失については、原則としてご自身の責任となります。
                  必要に応じて動産保険等のご加入を推奨いたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  撮影場所・施設に対する損害が発生した場合の責任範囲は、
                  プロジェクトごとの契約条件に従います。
                </li>
              </ul>
            </div>

            {/* 反社排除 */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">反社会的勢力の排除</h2>
              <p className="text-sm text-white/60 leading-relaxed">
                登録者は、自らが暴力団、暴力団関係企業、総会屋、その他の反社会的勢力に該当しないこと、
                および将来にわたって該当しないことを表明・保証するものとします。
                該当することが判明した場合、当社は直ちに登録を取り消すことができるものとします。
              </p>
            </div>

            {/* 免責・注意事項 */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="font-bold text-base mb-3">注意事項</h2>
              <ul className="space-y-2.5 text-sm text-white/60 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  本サービスは予告なく内容の変更、一時停止、または終了する場合があります。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  虚偽の情報によるご登録が判明した場合、アカウントを停止させていただく場合があります。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所といたします。
                </li>
                <li className="flex gap-2">
                  <span className="text-white/30 shrink-0">•</span>
                  本規約の内容は、必要に応じて改定することがあります。改定時にはメールにてお知らせいたします。
                </li>
              </ul>
            </div>
          </div>

          {/* 同意ボタン（スクロール外に固定） */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
            <button
              onClick={() => setAgreed(true)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:from-indigo-400 hover:to-purple-400 transition-all text-sm"
            >
              上記に同意して登録に進む
            </button>

            <a
              href="/creators"
              className="block text-center text-white/30 text-xs hover:text-white/50 transition-colors"
            >
              トップページに戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ===== 登録フォーム本体 =====
  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            クリエイター募集中
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            あなたの才能を、
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              全国のプロジェクトへ。
            </span>
          </h1>
          <p className="text-white/50 text-sm sm:text-base max-w-md mx-auto">
            Ad Arch Group のクリエイターネットワークに参加して、
            プロジェクト相談を受け取りましょう。
          </p>
        </div>

        {/* プログレスバー */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { n: 1, label: "基本情報" },
            { n: 2, label: "スキル" },
            { n: 3, label: "実績" },
            { n: 4, label: "契約" },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-2">
              <button
                onClick={() => n < step && setStep(n)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  n === step
                    ? "bg-white text-black"
                    : n < step
                      ? "bg-white/20 text-white cursor-pointer hover:bg-white/30"
                      : "bg-white/5 text-white/30"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    n < step
                      ? "bg-emerald-400 text-black"
                      : n === step
                        ? "bg-black text-white"
                        : "bg-white/10 text-white/30"
                  }`}
                >
                  {n < step ? "✓" : n}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {n < 4 && (
                <div
                  className={`w-6 h-px ${n < step ? "bg-emerald-400/50" : "bg-white/10"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* フォームカード */}
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8">
          {/* ===== Step 1: 基本情報 ===== */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold mb-1">基本情報</h2>
              <p className="text-white/40 text-sm mb-4">
                まずはあなたについて教えてください
              </p>

              {/* 法人/個人 選択 */}
              <Field label="区分" required>
                <div className="flex gap-3">
                  {[
                    { value: "individual" as const, label: "個人" },
                    { value: "corporation" as const, label: "法人" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEntityType(opt.value)}
                      className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        entityType === opt.value
                          ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                          : "bg-white/[0.02] border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 開業届・事業届出 */}
              <Field label="開業届・事業届出" required>
                <div className="flex gap-3">
                  {[
                    { value: "yes" as const, label: "届出済み" },
                    { value: "no" as const, label: "未届出" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setHasBusinessRegistration(opt.value)}
                      className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        hasBusinessRegistration === opt.value
                          ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                          : "bg-white/[0.02] border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {entityType === "individual" && hasBusinessRegistration === "no" && (
                  <p className="text-amber-400/70 text-xs mt-1.5">
                    個人でのお取引には開業届の提出を推奨しています
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="氏名" required>
                  <Input value={name} onChange={setName} placeholder="山田 太郎" />
                </Field>
                <Field label="フリガナ">
                  <Input value={nameKana} onChange={setNameKana} placeholder="ヤマダ タロウ" />
                </Field>
              </div>

              <Field label="メールアドレス" required>
                <Input value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
                {!emailVerified ? (
                  <div className="mt-2 space-y-2">
                    {!verificationSent ? (
                      <button
                        type="button"
                        disabled={isPending || !email || !name}
                        onClick={() => {
                          setError("");
                          startTransition(async () => {
                            const result = await sendVerificationCode(email, name);
                            if (result.success) {
                              setVerificationSent(true);
                            } else {
                              setError(result.error || "送信に失敗しました");
                            }
                          });
                        }}
                        className="px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 text-xs font-medium hover:bg-indigo-500/30 transition-all disabled:opacity-30"
                      >
                        {isPending ? "送信中..." : "認証コードを送信"}
                      </button>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="6桁のコード"
                          maxLength={6}
                          className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-center text-lg tracking-widest placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button
                          type="button"
                          disabled={isPending || verificationCode.length !== 6}
                          onClick={() => {
                            setError("");
                            startTransition(async () => {
                              const result = await verifyCode(email, verificationCode);
                              if (result.success) {
                                setEmailVerified(true);
                              } else {
                                setError(result.error || "認証に失敗しました");
                              }
                            });
                          }}
                          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-400 transition-all disabled:opacity-30"
                        >
                          {isPending ? "確認中..." : "確認"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerificationSent(false);
                            setVerificationCode("");
                          }}
                          className="text-xs text-white/30 hover:text-white/50"
                        >
                          再送信
                        </button>
                      </div>
                    )}
                    <p className="text-white/30 text-xs">
                      {verificationSent
                        ? "入力されたメールアドレスに認証コードを送信しました"
                        : "氏名とメールアドレスを入力後、認証コードを送信してください"}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-emerald-400 text-xs flex items-center gap-1">
                    <span>✓</span> メール認証済み
                  </p>
                )}
              </Field>

              <Field label="電話番号">
                <Input value={phone} onChange={setPhone} type="tel" placeholder="090-1234-5678" />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="活動拠点（都道府県）" required>
                  <Select value={prefecture} onChange={setPrefecture}>
                    <option value="">選択してください</option>
                    {PREFECTURES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="市区町村">
                  <Input value={city} onChange={setCity} placeholder="渋谷区" />
                </Field>
              </div>

              <Field label="屋号・法人名">
                <Input value={companyName} onChange={setCompanyName} placeholder="○○クリエイティブ" />
              </Field>

              <Field label="Webサイト / ポートフォリオURL">
                <Input value={website} onChange={setWebsite} type="url" placeholder="https://yoursite.com" />
                <p className="text-white/30 text-xs mt-1">
                  過去実績が掲載されているページがあればご入力ください
                </p>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="経験年数">
                  <Input value={yearsOfExp} onChange={setYearsOfExp} type="number" placeholder="5" />
                </Field>
                <Field label="日額単価（円）">
                  <Input value={dayRate} onChange={setDayRate} type="number" placeholder="30000" />
                </Field>
                <Field label="半日単価（円）">
                  <Input value={halfDayRate} onChange={setHalfDayRate} type="number" placeholder="18000" />
                </Field>
              </div>

              <Field label="月間稼働可能日数">
                <Input value={availability} onChange={setAvailability} type="number" placeholder="15" />
              </Field>

              <Field label="所有機材">
                <Textarea
                  value={equipment}
                  onChange={setEquipment}
                  placeholder="例: Sony FX6, DJI Mavic 3 Pro, Sennheiser MKH416, MacBook Pro M3 Max"
                  rows={3}
                />
              </Field>

              <Field label="自己PR">
                <Textarea
                  value={bio}
                  onChange={setBio}
                  placeholder="あなたの強み、得意ジャンル、大切にしていることなどを自由にお書きください"
                  rows={4}
                />
              </Field>
            </div>
          )}

          {/* ===== Step 2: スキル ===== */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold mb-1">スキル</h2>
              <p className="text-white/40 text-sm mb-4">
                得意なスキルを選択し、レベルを設定してください（複数可）
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SKILL_CATEGORIES.map((cat) => {
                  const selected = skills.find(
                    (s) => s.categoryId === cat.id
                  );
                  return (
                    <div key={cat.id}>
                      <button
                        type="button"
                        onClick={() => toggleSkill(cat.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          selected
                            ? "bg-indigo-500/20 border-indigo-400/50 shadow-lg shadow-indigo-500/10"
                            : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="text-lg mr-2">{cat.icon}</span>
                        <span className="text-sm font-medium">{cat.name}</span>
                      </button>

                      {selected && (
                        <div className="mt-2 ml-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex gap-1.5 flex-wrap">
                            {SKILL_LEVELS.map((lv) => (
                              <button
                                key={lv.value}
                                type="button"
                                onClick={() =>
                                  updateSkillLevel(cat.id, lv.value)
                                }
                                className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                                  selected.level === lv.value
                                    ? "bg-indigo-500 text-white"
                                    : "bg-white/5 text-white/50 hover:bg-white/10"
                                }`}
                                title={lv.desc}
                              >
                                {lv.label}
                              </button>
                            ))}
                          </div>
                          <Input
                            value={selected.note}
                            onChange={(v) => updateSkillNote(cat.id, v)}
                            placeholder="補足（使用ソフト、得意ジャンル等）"
                            className="text-xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {skills.length > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <p className="text-emerald-400 text-sm">
                    {skills.length}つのスキルを選択中
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ===== Step 3: ポートフォリオ ===== */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold mb-1">実績・ポートフォリオ</h2>
              <p className="text-white/40 text-sm mb-4">
                制作実績やポートフォリオのURLを登録してください。
                独自のポートフォリオサイトを優先してご入力ください。
              </p>

              {portfolios.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-3 items-center bg-white/[0.02] border border-white/10 rounded-xl p-4"
                >
                  <div className="flex-1">
                    <Input
                      value={p.url}
                      onChange={(v) => updatePortfolio(i, "url", v)}
                      placeholder="https://yourportfolio.com"
                      type="url"
                    />
                  </div>
                  {portfolios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePortfolio(i)}
                      className="text-white/30 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addPortfolio}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-white/60 hover:border-white/30 transition-all text-sm"
              >
                + URLを追加
              </button>
            </div>
          )}

          {/* ===== Step 4: NDA ===== */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold mb-1">守秘義務契約</h2>
              <p className="text-white/40 text-sm mb-4">
                登録にあたり、以下の守秘義務契約にご同意ください
              </p>

              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 max-h-80 overflow-y-auto text-sm text-white/70 space-y-3 leading-relaxed">
                <p className="font-bold text-white/90">
                  クリエイター守秘義務契約書（NDA）
                </p>
                <p>
                  本契約は、Ad Arch株式会社（以下「甲」）と、本プラットフォームに登録するクリエイター（以下「乙」）との間で締結される守秘義務契約です。
                </p>
                <p className="font-bold text-white/90">第1条（秘密情報の定義）</p>
                <p>
                  秘密情報とは、甲が乙に開示するプロジェクトに関する一切の情報（クライアント名、企画内容、予算、スケジュール、制作物の内容等）をいいます。
                </p>
                <p className="font-bold text-white/90">第2条（秘密保持義務）</p>
                <p>
                  乙は、秘密情報を第三者に開示・漏洩してはならず、プロジェクト遂行の目的以外に使用してはなりません。
                </p>
                <p className="font-bold text-red-300">第3条（制作実績の利用制限）</p>
                <p className="text-red-200/80">
                  乙は、甲を通じて参加したプロジェクトの制作物・実績を、乙自身のポートフォリオ・営業資料・SNS等で使用することはできません。グループ実績の二次利用は固く禁止いたします。使用を希望する場合は、甲の書面による事前承諾を得る必要があります。
                </p>
                <p className="font-bold text-red-300">第4条（虚偽申告・不正行為の禁止）</p>
                <p className="text-red-200/80">
                  乙は、登録情報・スキル・経歴・実績等について虚偽の申告を行ってはなりません。
                  虚偽の情報に基づき案件に応募・参加し、クライアントまたは甲に損害が発生した場合、
                  乙は以下のペナルティを負うものとします。
                </p>
                <ul className="text-red-200/80 ml-4 mt-1 space-y-1 text-sm list-disc">
                  <li>当該案件の報酬の全額返還</li>
                  <li>クライアントおよび甲に生じた損害の全額賠償</li>
                  <li>アカウントの即時停止および永久追放</li>
                  <li>悪質な場合は法的措置の対象</li>
                </ul>
                <p className="font-bold text-white/90 mt-3">第5条（契約期間）</p>
                <p>
                  本契約は、乙の登録日から有効とし、乙が退会した後も5年間効力を有します。
                </p>
                <p className="font-bold text-white/90">第6条（損害賠償）</p>
                <p>
                  乙が本契約に違反した場合、甲は乙に対して損害賠償を請求できるものとします。
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={ndaAgreed}
                  onChange={(e) => setNdaAgreed(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 accent-indigo-500"
                />
                <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                  上記の守秘義務契約の内容を確認し、同意します。
                  グループ実績を自身のポートフォリオ等で使用しないことに同意します。
                </span>
              </label>

              {/* グループ加盟の興味 */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="text-sm text-white/70 mb-3">
                  クリエイターとしてだけでなく、ご自身の拠点を持ち映像制作事業を経営することにも興味はありますか？
                </p>
                <div className="flex gap-3">
                  {[
                    { value: true, label: "経営者としてグループ参画に興味がある" },
                    { value: false, label: "まずはクリエイターとして登録" },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setInterestedInPartnership(opt.value)}
                      className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        interestedInPartnership === opt.value
                          ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                          : "bg-white/[0.02] border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-white/30 text-xs mt-1.5">
                  ご興味のある方には、後日グループ加盟制度のご案内をお送りする場合があります
                </p>
              </div>
            </div>
          )}

          {/* ナビゲーションボタン */}
          <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-5 py-2.5 rounded-lg text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                戻る
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-all"
              >
                次へ
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !ndaAgreed}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium hover:from-indigo-400 hover:to-purple-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? "登録中..." : "登録する"}
              </button>
            )}
          </div>
        </div>

        {/* フッター */}
        <p className="text-center text-white/20 text-xs mt-8">
          Ad Arch Group Creator Network
        </p>
      </div>
    </div>
  );
}

// ===== UI Components =====

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1.5">
        {label}
        {required && <span className="text-indigo-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm ${className}`}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm resize-none"
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-sm appearance-none"
    >
      {children}
    </select>
  );
}
