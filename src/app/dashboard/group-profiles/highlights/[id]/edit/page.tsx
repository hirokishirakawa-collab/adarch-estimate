import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHighlightById, adminUpdateHighlight, adminDeleteHighlight } from "@/lib/actions/collaboration-highlight";
import { getGroupCompanyOptions } from "@/lib/actions/admin";
import { HighlightForm } from "@/components/group-profiles/highlight-form";
import type { UserRole } from "@/types/roles";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditHighlightPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const [highlight, companies] = await Promise.all([
    getHighlightById(id),
    getGroupCompanyOptions(),
  ]);

  if (!highlight) notFound();

  const boundAction = adminUpdateHighlight.bind(null, id);
  const boundDelete = adminDeleteHighlight.bind(null, id);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <HighlightForm
        companies={companies}
        highlight={highlight}
        action={boundAction}
        onDelete={boundDelete}
      />
    </div>
  );
}
