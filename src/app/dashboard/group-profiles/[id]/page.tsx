import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProfileById, getMyGroupCompany } from "@/lib/actions/group-profile";
import { ProfileDetail } from "@/components/group-profiles/profile-detail";
import type { UserRole } from "@/types/roles";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GroupProfileDetailPage({ params }: Props) {
  const { id } = await params;
  const [profile, myCompany, session] = await Promise.all([
    getProfileById(id),
    getMyGroupCompany(),
    auth(),
  ]);

  if (!profile || !profile.isActive) notFound();

  const role = (session?.user?.role ?? "USER") as UserRole;
  const isOwner = myCompany?.id === profile.id;
  const isAdmin = role === "ADMIN";

  const canEdit = isOwner || isAdmin;
  const editHref = isAdmin
    ? `/dashboard/group-profiles/${id}/edit`
    : "/dashboard/group-profiles/edit";

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <ProfileDetail profile={profile} canEdit={canEdit} editHref={editHref} isOwner={isOwner} />
    </div>
  );
}
