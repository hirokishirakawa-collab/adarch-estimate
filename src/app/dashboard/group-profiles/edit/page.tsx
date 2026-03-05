import { redirect } from "next/navigation";
import { getMyGroupCompany, updateProfile } from "@/lib/actions/group-profile";
import { ProfileForm } from "@/components/group-profiles/profile-form";

export default async function EditMyProfilePage() {
  const myCompany = await getMyGroupCompany();
  if (!myCompany) redirect("/dashboard/group-profiles");

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <ProfileForm
        profile={myCompany}
        action={updateProfile}
        backHref={`/dashboard/group-profiles/${myCompany.id}`}
      />
    </div>
  );
}
