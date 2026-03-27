import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";

export default async function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-black text-white">
      {children}
      <Toaster richColors position="top-right" />
    </div>
  );
}
