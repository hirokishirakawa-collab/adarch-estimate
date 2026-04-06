import Link from "next/link";

export default function RegisterCompletePage() {
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
