import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectRequestForm } from "./project-request-form";
import { AdminProjectRequestForm } from "./admin-project-form";
import { getActiveCompanies } from "@/lib/actions/project-matching";

export default async function NewProjectRequestPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user.role ?? "USER") as string;
  const isAdmin = role === "ADMIN";
  const companies = isAdmin ? await getActiveCompanies() : [];

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link
          href="/dashboard/project-matching"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          案件一覧に戻る
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">案件を投稿</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {isAdmin
            ? "管理者として案件を投稿できます。対象企業を選択して通知できます。"
            : "グループ企業に紹介したい案件を投稿してください"}
        </p>
      </div>
      {isAdmin ? (
        <AdminProjectRequestForm companies={companies} />
      ) : (
        <ProjectRequestForm />
      )}
    </div>
  );
}
