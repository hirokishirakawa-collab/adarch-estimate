import { db } from "@/lib/db";
import { MoveTabs } from "./move-tabs";

// ---------------------------------------------------------------
// /move?space=<chatSpaceId>
//   Chat のカードから開く「動きを出す」1画面。
//   「1件ずつ」と「AIに書かせて貼る（OS未使用の代表向け・JSON一括）」の2タブ。
//   週次共有フォーム（/group-support/submit）と同じくログインを求めない。
// ---------------------------------------------------------------
export default async function MovePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space } = await searchParams;

  if (!space) {
    return (
      <Shell>
        <p className="text-center text-zinc-500 py-8">無効なリンクです</p>
      </Shell>
    );
  }

  const company = await db.groupCompany.findFirst({
    where: { chatSpaceId: space, isActive: true },
    select: { ownerName: true, name: true },
  });

  if (!company) {
    return (
      <Shell>
        <p className="text-center text-zinc-500 py-8">企業情報が見つかりません</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <MoveTabs chatSpaceId={space} partnerName={company.ownerName || company.name} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 sm:p-7">
        {children}
      </div>
    </div>
  );
}
