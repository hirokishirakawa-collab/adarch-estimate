import Link from "next/link";

export default function CreatorsTopPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-indigo-600/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[130px]" />
      </div>

      {/* ナビ */}
      <nav className="relative z-10 flex items-center justify-between max-w-5xl mx-auto px-6 py-6">
        <span className="text-sm font-bold tracking-widest text-white/80">
          AD ARCH GROUP
        </span>
        <Link
          href="/creators/register"
          className="px-5 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-white/80 hover:bg-white/20 transition-all"
        >
          登録する
        </Link>
      </nav>

      {/* ヒーロー */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-20 sm:pt-32 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/50 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          全国のクリエイターを募集中
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
          あなたの技術が、
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            次のプロジェクトを動かす。
          </span>
        </h1>

        <p className="text-white/40 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Ad Arch Group の映像制作ネットワークに参加しませんか。
          <br className="hidden sm:block" />
          あなたのスキルとエリアに合った
          <br className="hidden sm:block" />
          プロジェクト相談を直接お届けします。
        </p>

        <Link
          href="/creators/register"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-base hover:from-indigo-400 hover:to-purple-400 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
        >
          無料で登録する
          <svg
            className="w-4 h-4"
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
        </Link>
      </section>

      {/* 特徴 */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: "📍",
              title: "エリアマッチング",
              desc: "あなたの活動エリアに合った案件のみご相談。無駄な移動はありません。",
            },
            {
              icon: "🎯",
              title: "スキルベースの紹介",
              desc: "撮影・編集・CG・ドローン等、得意分野に合ったプロジェクトをご案内。",
            },
            {
              icon: "🤝",
              title: "継続的な関係",
              desc: "単発ではなく、信頼関係を築きながら継続的にお仕事をご依頼します。",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
            >
              <span className="text-3xl mb-4 block">{item.icon}</span>
              <h3 className="font-bold text-base mb-2">{item.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 募集スキル */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-3">募集スキル</h2>
        <p className="text-white/40 text-center text-sm mb-10">
          以下のスキルをお持ちのクリエイターを募集しています
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {[
            { icon: "🎬", name: "撮影" },
            { icon: "✂️", name: "編集" },
            { icon: "💫", name: "モーショングラフィックス" },
            { icon: "🎨", name: "カラーグレーディング" },
            { icon: "🚁", name: "ドローン撮影" },
            { icon: "🎙️", name: "音声収録・MA" },
            { icon: "🗣️", name: "ナレーション" },
            { icon: "📋", name: "ディレクション" },
            { icon: "📝", name: "企画・脚本" },
            { icon: "🌐", name: "3DCG・VFX" },
          ].map((skill) => (
            <span
              key={skill.name}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/70"
            >
              <span>{skill.icon}</span>
              {skill.name}
            </span>
          ))}
        </div>
      </section>

      {/* 登録の流れ */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">登録の流れ</h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            {
              step: "01",
              title: "基本情報入力",
              desc: "名前・エリア・単価感・機材などを登録",
            },
            {
              step: "02",
              title: "スキル登録",
              desc: "得意分野とレベルを細かく設定",
            },
            {
              step: "03",
              title: "実績登録",
              desc: "ポートフォリオURLや動画リンクを追加",
            },
            {
              step: "04",
              title: "NDA締結",
              desc: "守秘義務契約に同意して登録完了",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-sm font-bold text-indigo-300">
                  {item.step}
                </span>
              </div>
              <h3 className="font-bold text-sm mb-1">{item.title}</h3>
              <p className="text-white/40 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-400/20 rounded-3xl p-10 sm:p-14">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            プロジェクトの相談を
            <br />
            受け取る準備はできましたか？
          </h2>
          <p className="text-white/40 text-sm mb-8">
            登録は無料。約3分で完了します。
          </p>
          <Link
            href="/creators/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black font-medium text-base hover:bg-white/90 transition-all"
          >
            クリエイター登録する
            <svg
              className="w-4 h-4"
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
          </Link>
        </div>
      </section>

      {/* フッター */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
  );
}
