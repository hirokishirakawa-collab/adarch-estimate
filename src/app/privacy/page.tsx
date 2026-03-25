export const metadata = { title: "プライバシーポリシー | Ad Arch Group" };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", fontFamily: "sans-serif", color: "#1a1a1a", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>プライバシーポリシー</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>最終更新日: 2026年3月25日</p>

      <p>Ad Arch株式会社（以下「当社」）は、Ad Archアプリケーション（以下「本アプリ」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。</p>

      <h2>1. 収集する情報</h2>
      <p>本アプリでは以下の情報を収集することがあります。</p>
      <ul>
        <li>Googleアカウント情報（氏名、メールアドレス、プロフィール画像）</li>
        <li>位置情報（ロケハン撮影時、任意）</li>
        <li>カメラで撮影した画像（看板スキャン、ロケハン撮影時）</li>
        <li>デバイスのプッシュ通知トークン</li>
      </ul>

      <h2>2. 情報の利用目的</h2>
      <ul>
        <li>ユーザー認証およびアクセス管理</li>
        <li>撮影画像のAI分析（カット表生成、企業情報抽出）</li>
        <li>位置情報の記録（撮影場所の特定）</li>
        <li>プッシュ通知の配信</li>
        <li>サービスの改善および運用</li>
      </ul>

      <h2>3. 情報の第三者提供</h2>
      <p>当社は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。ただし、以下のサービスを利用しています。</p>
      <ul>
        <li>Google OAuth（認証）</li>
        <li>Anthropic Claude API（AI分析）</li>
        <li>Expo Push Notifications（通知配信）</li>
      </ul>

      <h2>4. 情報の管理</h2>
      <p>当社は、個人情報の漏洩、滅失またはき損の防止のため、適切なセキュリティ対策を講じます。</p>

      <h2>5. ユーザーの権利</h2>
      <p>ユーザーは、当社に対して個人情報の開示、訂正、削除を請求することができます。</p>

      <h2>6. お問い合わせ</h2>
      <p>Ad Arch株式会社<br />メール: hiroki.shirakawa@adarch.co.jp</p>

      <h2>7. 改定</h2>
      <p>当社は、必要に応じて本ポリシーを改定することがあります。改定後のポリシーは本ページに掲載した時点で効力を生じます。</p>
    </div>
  );
}
