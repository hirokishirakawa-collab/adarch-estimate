import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseFormFields } from "@/lib/line/service";
import { PublicLineForm } from "@/components/line/public-form";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// ---------------------------------------------------------------
// /f/[token]/[code] — 回答フォーム（LINE内ブラウザで開く・認証なし）
// 誰の回答かは token（相手ごと）で判定する
// ---------------------------------------------------------------
export default async function PublicFormPage({ params }: { params: Promise<{ token: string; code: string }> }) {
  const { token, code } = await params;
  const decoded = decodeURIComponent(code);
  const friend = await db.lineFriend.findUnique({ where: { token }, select: { accountId: true, displayName: true, account: { select: { botDisplayName: true, name: true } } } });
  if (!friend) notFound();
  const form = await db.lineForm.findUnique({ where: { accountId_code: { accountId: friend.accountId, code: decoded } } });
  if (!form) notFound();
  const fields = parseFormFields(form.fields);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <p className="text-[11px] text-zinc-400 mb-2">{friend.account.botDisplayName ?? friend.account.name}</p>
        <h1 className="text-lg font-bold text-zinc-900">{form.title}</h1>
        {form.description && <p className="text-sm text-zinc-600 mt-2 whitespace-pre-wrap">{form.description}</p>}
        {!form.isActive ? (
          <p className="mt-6 text-sm text-zinc-500">このフォームは受付を終了しています。</p>
        ) : (
          <PublicLineForm token={token} code={decoded} fields={fields} />
        )}
      </div>
    </main>
  );
}
