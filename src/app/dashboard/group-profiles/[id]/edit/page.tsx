import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProfileById, adminUpdateProfile, adminDeleteProfile } from "@/lib/actions/group-profile";
import { ProfileForm } from "@/components/group-profiles/profile-form";
import type { UserRole } from "@/types/roles";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminEditProfilePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const profile = await getProfileById(id);
  if (!profile || !profile.isActive) notFound();

  const boundAction = adminUpdateProfile.bind(null, id);
  const boundDelete = adminDeleteProfile.bind(null, id);

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <ProfileForm
        profile={profile}
        action={boundAction}
        backHref={`/dashboard/group-profiles/${id}`}
        onDelete={boundDelete}
      />
    </div>
  );
}
