import Link from "next/link";

export default function CreatorsTopPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden flex items-center justify-center">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-indigo-600/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        {/* ロゴ */}
        <div className="text-center mb-16">
          <span className="text-sm font-bold tracking-widest text-white/80">
            AD ARCH GROUP
          </span>
        </div>

        {/* 見出し */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
            あなたに合った形で、
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              映像の仕事を始めよう。
            </span>
          </h1>
          <p className="text-white/40 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            まずはご希望の形態をお選びください。
          </p>
        </div>

        {/* 選択カード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* 加盟希望 */}
          <Link
            href="/creators/group"
            className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-8 hover:border-amber-400/40 hover:bg-amber-500/[0.03] transition-all"
          >
            <div className="absolute top-4 right-4">
              <svg
                className="w-5 h-5 text-white/20 group-hover:text-amber-400 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-400/30 flex items-center justify-center mb-5">
              <span className="text-2xl">🏢</span>
            </div>

            <h2 className="text-lg font-bold mb-2 group-hover:text-amber-300 transition-colors">
              グループ加盟
            </h2>
            <p className="text-white/40 text-sm leading-relaxed mb-4">
              ご自身の拠点を持ち、Ad Arch Group のパートナーとして映像制作事業を経営しませんか。
            </p>

            <ul className="space-y-1.5 text-xs text-white/30">
              <li className="flex items-center gap-2">
                <span className="text-amber-400/60">&#10003;</span>
                営業支援・制作ツール完備
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400/60">&#10003;</span>
                グループのネットワークを活用
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-400/60">&#10003;</span>
                経営サポート・研修あり
              </li>
            </ul>
          </Link>

          {/* クリエイター登録 */}
          <Link
            href="/creators/register"
            className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-8 hover:border-indigo-400/40 hover:bg-indigo-500/[0.03] transition-all"
          >
            <div className="absolute top-4 right-4">
              <svg
                className="w-5 h-5 text-white/20 group-hover:text-indigo-400 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 flex items-center justify-center mb-5">
              <span className="text-2xl">🎬</span>
            </div>

            <h2 className="text-lg font-bold mb-2 group-hover:text-indigo-300 transition-colors">
              クリエイター登録
            </h2>
            <p className="text-white/40 text-sm leading-relaxed mb-4">
              映像クリエイターとしてネットワークに参加。スキルに合ったプロジェクト相談をお届けします。
            </p>

            <ul className="space-y-1.5 text-xs text-white/30">
              <li className="flex items-center gap-2">
                <span className="text-indigo-400/60">&#10003;</span>
                エリア・スキルマッチング
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400/60">&#10003;</span>
                案件単位での業務委託
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400/60">&#10003;</span>
                登録無料・約3分で完了
              </li>
            </ul>
          </Link>
        </div>

        {/* 補足 */}
        <p className="text-center text-white/20 text-xs mt-10">
          どちらが自分に合っているか分からない場合は、まず「グループ加盟」ページからお気軽にご相談ください。
        </p>

        {/* フッター */}
        <footer className="mt-20 pt-8 border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-white/20">
              &copy; {new Date().getFullYear()} Ad Arch Co., Ltd. All rights
              reserved.
            </span>
            <div className="flex gap-6 text-xs text-white/20">
              <a
                href="https://adarch.co.jp"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white/40 transition-colors"
              >
                コーポレートサイト
              </a>
              <Link
                href="/privacy"
                className="hover:text-white/40 transition-colors"
              >
                プライバシーポリシー
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
