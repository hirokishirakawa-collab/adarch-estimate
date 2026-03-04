import { db } from "@/lib/db";
import { SubmitForm } from "./submit-form";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space } = await searchParams;

  if (!space) {
    return (
      <Shell>
        <p className="text-center text-zinc-500 py-8">
          無効なリンクです
        </p>
      </Shell>
    );
  }

  const company = await db.groupCompany.findFirst({
    where: { chatSpaceId: space, isActive: true },
  });

  if (!company) {
    return (
      <Shell>
        <p className="text-center text-zinc-500 py-8">
          企業情報が見つかりません
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <SubmitForm chatSpaceId={space} companyName={company.name} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
