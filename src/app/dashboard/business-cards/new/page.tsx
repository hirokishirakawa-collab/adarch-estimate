import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ContactRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { QuickRegisterForm } from "@/components/business-cards/quick-register-form";

export default async function NewBusinessCardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-md mx-auto w-full">
      <Link
        href="/dashboard/business-cards"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        名刺一覧に戻る
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
          <ContactRound
            style={{ width: "1.125rem", height: "1.125rem" }}
            className="text-teal-600"
          />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-900">名刺を登録</h1>
          <p className="text-xs text-zinc-500">
            写真からAI自動入力、または手動で登録できます
          </p>
        </div>
      </div>

      <QuickRegisterForm />
    </div>
  );
}
