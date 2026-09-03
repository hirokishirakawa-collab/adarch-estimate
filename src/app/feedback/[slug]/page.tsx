import { db } from "@/lib/db";
import { FeedbackForm } from "./feedback-form";

// ---------------------------------------------------------------
// /feedback/<パッケージslug>?from=<加盟会社ID>
//   AI用データ・パッケージを使った感想を送る1画面。ログインを求めない
//   （/move・/group-support/submit と同じ。proxy.ts の matcher で feedback/ を除外済み）
//   from= があれば拠点を特定して名前を既定にする。無くても名前欄だけで送れる
// ---------------------------------------------------------------
export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { slug } = await params;
  const { from } = await searchParams;

  const pkg = await db.salesPackage.findUnique({ where: { slug }, select: { name: true } });
  if (!pkg) {
    return (
      <Shell>
        <p className="text-center text-zinc-500 py-8">パッケージが見つかりません</p>
      </Shell>
    );
  }

  const company = from
    ? await db.groupCompany.findFirst({ where: { id: from, isActive: true }, select: { name: true, ownerName: true, prefecture: true } })
    : null;
  const defaultName = company ? `${company.ownerName || company.name}${company.prefecture ? `（${company.prefecture}）` : ""}` : "";

  return (
    <Shell>
      <FeedbackForm slug={slug} from={company ? from! : ""} packageName={pkg.name} defaultName={defaultName} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 sm:p-7">{children}</div>
    </div>
  );
}
