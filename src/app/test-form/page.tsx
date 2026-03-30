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

  if (submitted) {
    const name = searchParams.name ?? "";
    const email = searchParams.email ?? "";
    const message = searchParams.message ?? "";

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
      <h1>お問い合わせ</h1>
      <p style={{ color: "#666" }}>動画制作・広告に関するご相談はこちらからお気軽にどうぞ。</p>
      <form action="/test-form/submit" method="POST" style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>お名前 *</label>
          <input name="name" type="text" required style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }} />
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
