import { db } from "@/lib/db";

export default function TestFormPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return <TestForm searchParamsPromise={searchParams} />;
}

async function TestForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<Record<string, string>>;
}) {
  const searchParams = await searchParamsPromise;
  const submitted = searchParams.submitted === "true";

  // 送信済みの場合、DBに記録して完了画面
  if (submitted) {
    const name = searchParams.name ?? "";
    const email = searchParams.email ?? "";
    const message = searchParams.message ?? "";

    if (name || email || message) {
      // テスト送信ログをDBに記録（AppSettingを利用）
      await db.appSetting.upsert({
        where: { key: "test-form-last-submission" },
        create: {
          key: "test-form-last-submission",
          value: JSON.stringify({ name, email, message, at: new Date().toISOString() }),
        },
        update: {
          value: JSON.stringify({ name, email, message, at: new Date().toISOString() }),
        },
      });
    }

    return (
      <div style={{ maxWidth: 600, margin: "80px auto", fontFamily: "sans-serif", textAlign: "center" }}>
        <h1 style={{ color: "#16a34a" }}>送信完了</h1>
        <p>お問い合わせありがとうございます。</p>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 20, marginTop: 20, textAlign: "left" }}>
          <p><strong>名前:</strong> {name}</p>
          <p><strong>メール:</strong> {email}</p>
          <p><strong>メッセージ:</strong></p>
          <p style={{ whiteSpace: "pre-wrap" }}>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>お問い合わせ（テスト用）</h1>
      <p style={{ color: "#666" }}>このフォームは自動営業workerのテスト用です。reCAPTCHAなし。</p>
      <form action="/test-form" method="GET" style={{ marginTop: 20 }}>
        <input type="hidden" name="submitted" value="true" />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>お名前 *</label>
          <input name="name" required style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>メールアドレス *</label>
          <input name="email" type="email" required style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>お問い合わせ内容</label>
          <textarea name="message" rows={5} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }} />
        </div>
        <button type="submit" style={{ background: "#2563eb", color: "white", border: "none", padding: "12px 32px", borderRadius: 6, fontSize: 14, cursor: "pointer" }}>
          送信
        </button>
      </form>
    </div>
  );
}
