import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ partnership?: string }>;
}

export default async function RegisterCompletePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const interestedInPartnership = params.partnership === "1";

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden flex items-center justify-center">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 text-center">
        {/* 成功アニメーション */}
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-8 animate-bounce">
          <svg
            className="w-10 h-10 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold mb-4">
          <span className="bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
            登録完了！
          </span>
        </h1>

        <p className="text-white/60 mb-3 leading-relaxed">
          クリエイターネットワークへの登録ありがとうございます。
        </p>
        <p className="text-white/60 mb-8 leading-relaxed">
          プロジェクトの相談が届いた際は、
          <br />
          ご登録のメールアドレスにご連絡いたします。
        </p>

        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-8 text-left">
          <h2 className="text-sm font-bold text-white/80 mb-3">
            次のステップ
          </h2>
          <ul className="space-y-2 text-sm text-white/50">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">1.</span>
              <span>
                ご登録内容を元に、あなたのプロフィールが作成されました
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">2.</span>
              <span>
                ご登録内容をスタッフが確認しています
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">3.</span>
              <span>
                マッチするプロジェクトが見つかり次第、メールでご相談をお送りします
              </span>
            </li>
          </ul>
        </div>

        {/* グループ加盟に興味ありの場合 */}
        {interestedInPartnership && (
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-400/20 rounded-xl p-6 mb-8 text-left">
            <h2 className="text-sm font-bold text-white/90 mb-2">
              グループ加盟にご興味をお持ちいただきありがとうございます
            </h2>
            <p className="text-sm text-white/50 mb-4 leading-relaxed">
              Ad Arch Group では、映像制作事業を経営するパートナーを募集しています。
              ご自身の拠点を持ち、グループのネットワークとツールを活用しながら
              映像制作ビジネスを展開できます。
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://adarch.co.jp/group"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium hover:from-indigo-400 hover:to-purple-400 transition-all"
              >
                加盟制度について詳しく見る
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0-yourlink"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all"
              >
                オンライン面談を予約する
              </a>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/creators/register"
            className="text-sm text-white/30 hover:text-white/50 transition-colors"
          >
            別のアカウントを登録する
          </Link>
        </div>

        <p className="text-white/15 text-xs mt-12">
          守秘義務契約（NDA）は登録時に締結済みです。
          <br />
          Ad Arch Group Creator Network
        </p>
      </div>
    </div>
  );
}
