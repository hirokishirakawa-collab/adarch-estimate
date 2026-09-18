import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { searchWorkspaceLibrary, type LibraryQuery } from "@/lib/workspace/library-search";
import type { UserRole } from "@/types/roles";
import { LibraryBrowser } from "@/components/workspace/library-browser";

export default async function LibrarySearchPage({
  searchParams,
}: {
  searchParams: Promise<LibraryQuery>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const input = await searchParams;
  const rows = await searchWorkspaceLibrary(
    {
      role: (session.user.role ?? "USER") as UserRole,
      email: session.user.email,
    },
    input,
  );
  return (
    <LibraryBrowser
      key={JSON.stringify(input)}
      input={input}
      rows={rows}
      showOutreach={session.user.role !== "USER"}
    />
  );
}
