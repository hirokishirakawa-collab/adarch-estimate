import Link from "next/link";

export default function GroupPartnershipPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden">
      {/* 背景エフェクト */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-indigo-600/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[120px]" />
      </div>

      {/* ナビ */}
      <nav className="relative z-10 flex items-center justify-between max-w-5xl mx-auto px-6 py-6">
        <span className="text-sm font-bold tracking-widest text-white/80">
          AD ARCH GROUP
        </span>
        <Link
          href="/creators"
          className="px-5 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-white/80 hover:bg-white/20 transition-all"
        >
          クリエイター登録はこちら
        </Link>
      </nav>

      {/* ヒーロー */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-16 sm:pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/20 text-sm text-amber-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          パートナー募集中
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-6">
          映像クリエイターから、
          <br />
          <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            映像事業の経営者へ。
          </span>
        </h1>

        <p className="text-white/40 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Ad Arch Group のパートナーとして、ご自身の拠点で映像制作事業を経営しませんか。
          <br className="hidden sm:block" />
          グループのネットワーク・ツール・ノウハウを活用して、
          <br className="hidden sm:block" />
          クリエイターとしての技術を経営の力に変えることができます。
        </p>
      </section>

      {/* パートナーとは */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-3">
          グループパートナーとは
        </h2>
        <p className="text-white/40 text-center text-sm mb-10 max-w-2xl mx-auto leading-relaxed">
          Ad Arch Group のパートナーは、独立した経営者として自身の拠点を持ちながら、
          グループ全体のリソースを活用して映像制作事業を展開します。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: "🏢",
              title: "あなたの拠点を持つ",
              desc: "お住まいのエリアで映像制作事業を立ち上げ。地域密着型のビジネスを経営できます。",
            },
            {
              icon: "🔗",
              title: "グループの力を活用",
              desc: "営業支援・制作ツール・顧客管理・見積システムなど、経営に必要な基盤が揃っています。",
            },
            {
              icon: "📈",
              title: "成長をサポート",
              desc: "案件紹介・スキルアップ研修・経営相談など、事業成長を継続的にバックアップします。",
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

      {/* 提供されるもの */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-10">
          パートナーに提供されるもの
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: "💼",
              title: "営業支援ツール",
              desc: "リード獲得AI・提案書自動生成・CRMなど、営業活動を効率化するツール群",
            },
            {
              icon: "🎬",
              title: "制作支援ツール",
              desc: "見積システム・媒体シミュレーター・SNS動画テンプレートなど、制作業務をサポート",
            },
            {
              icon: "👥",
              title: "クリエイターネットワーク",
              desc: "グループ登録クリエイターへの発注が可能。撮影・編集・CG等の外注リソースを確保",
            },
            {
              icon: "📊",
              title: "経営ダッシュボード",
              desc: "売上・顧客・案件の管理をワンストップで。データに基づいた経営判断をサポート",
            },
            {
              icon: "🎓",
              title: "研修・ラーニング",
              desc: "媒体知識・営業スキル・制作技術のオンライン研修を受講可能",
            },
            {
              icon: "🤝",
              title: "案件紹介・連携",
              desc: "グループ内の案件紹介や、他拠点との連携プロジェクトに参加可能",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex gap-4 bg-white/[0.02] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all"
            >
              <span className="text-2xl shrink-0">{item.icon}</span>
              <div>
                <h3 className="font-bold text-sm mb-1">{item.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 加盟の流れ */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-10">加盟までの流れ</h2>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {[
            {
              step: "01",
              title: "お問い合わせ",
              desc: "フォームまたはオンライン面談からご連絡",
            },
            {
              step: "02",
              title: "面談・ヒアリング",
              desc: "ご経験・ビジョン・エリアについてお話",
            },
            {
              step: "03",
              title: "加盟条件の確認",
              desc: "費用・契約内容の詳細をご説明",
            },
            {
              step: "04",
              title: "契約・準備",
              desc: "契約締結後、ツール導入・研修を実施",
            },
            {
              step: "05",
              title: "事業開始",
              desc: "営業開始。継続的なサポートを提供",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-sm font-bold text-amber-300">
                  {item.step}
                </span>
              </div>
              <h3 className="font-bold text-sm mb-1">{item.title}</h3>
              <p className="text-white/40 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* こんな方におすすめ */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-10">
          こんな方におすすめ
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            "映像制作のスキルを活かして独立したい方",
            "フリーランスから経営者へステップアップしたい方",
            "地元で映像制作ビジネスを始めたい方",
            "既に映像制作をしていて、さらに事業を拡大したい方",
            "営業やツールの仕組みが整った環境で起業したい方",
            "クリエイティブと経営の両方に興味がある方",
          ].map((text) => (
            <div
              key={text}
              className="flex items-center gap-3 bg-white/[0.02] border border-white/10 rounded-xl px-5 py-4"
            >
              <span className="text-amber-400 shrink-0">✓</span>
              <span className="text-sm text-white/70">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-400/20 rounded-3xl p-10 sm:p-14">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            まずはお気軽にご相談ください
          </h2>
          <p className="text-white/40 text-sm mb-8">
            オンライン面談で、加盟制度の詳細やあなたのビジョンについてお話しましょう。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://calendar.app.google/SCpPs7pNYafyBmTs6"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-black font-medium text-base hover:from-amber-300 hover:to-yellow-300 transition-all shadow-lg shadow-amber-500/25"
            >
              オンライン面談を予約する
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
            </a>
            <a
              href="mailto:info@adarch.co.jp?subject=グループ加盟について"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-medium text-base hover:bg-white/20 transition-all"
            >
              メールで問い合わせる
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-10">
          よくあるご質問
        </h2>

        <div className="space-y-4">
          {[
            {
              q: "映像制作の経験がなくても加盟できますか？",
              a: "映像制作の実務経験をお持ちの方を対象としています。クリエイターとしてのスキルをベースに、経営者としてのステップアップを支援します。",
            },
            {
              q: "初期費用はどのくらいかかりますか？",
              a: "加盟金・月額ロイヤリティ等の詳細は面談時にご説明いたします。お気軽にお問い合わせください。",
            },
            {
              q: "副業として始められますか？",
              a: "まずは副業からスタートし、軌道に乗ったら本業に切り替えるパートナーもいらっしゃいます。面談で働き方についてご相談ください。",
            },
            {
              q: "どのエリアで開業できますか？",
              a: "全国どのエリアでも開業可能です。地域の市場特性に合わせた営業戦略もサポートします。",
            },
            {
              q: "クリエイター登録とパートナー加盟の違いは？",
              a: "クリエイター登録は案件単位での業務委託です。パートナー加盟は自身の拠点を持ち、経営者として事業を展開する形態です。グループのツール・ネットワークをフル活用できます。",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="bg-white/[0.03] border border-white/10 rounded-xl p-5"
            >
              <h3 className="font-bold text-sm text-white/90 mb-2">
                Q. {item.q}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed">
                A. {item.a}
              </p>
            </div>
          ))}
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
              href="/creators"
              className="hover:text-white/40 transition-colors"
            >
              クリエイター登録
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
