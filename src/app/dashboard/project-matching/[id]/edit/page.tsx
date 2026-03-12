import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProjectRequestDetail } from "@/lib/actions/project-matching";
import { EditProjectRequestForm } from "./edit-form";

export default async function EditProjectRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { request, currentCompanyId } = await getProjectRequestDetail(id);
  if (!request) notFound();

  const role = (session.user.role ?? "USER") as string;
  const isOwner = request.postedByCompanyId === currentCompanyId;
  if (!isOwner && role !== "ADMIN") redirect(`/dashboard/project-matching/${id}`);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <Link
          href={`/dashboard/project-matching/${id}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          案件詳細に戻る
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">案件を編集</h1>
      </div>
      <EditProjectRequestForm
        projectRequestId={request.id}
        defaultValues={{
          title: request.title,
          description: request.description,
          category: request.category,
          frequency: request.frequency,
          budget: request.budget,
          prefecture: request.prefecture,
          deadline: request.deadline
            ? new Date(request.deadline).toISOString().split("T")[0]
            : "",
        }}
      />
    </div>
  );
}
