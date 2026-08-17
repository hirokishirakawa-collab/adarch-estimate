import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types/roles";
import { getOutreachLeads, getSharedOutreachActivity } from "@/lib/actions/outreach";
import { OutreachBoard } from "./outreach-board";

export const dynamic = "force-dynamic";

export default async function OutreachPipelinePage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  // 加盟している段階で使える。本部が個別に許可を出す運用はやめた。
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/dashboard");

  const [leads, shared] = await Promise.all([
    getOutreachLeads(),
    getSharedOutreachActivity(),
  ]);

  const rows = leads.map((l) => ({
    id: l.id,
    companyName: l.companyName,
    contactName: l.contactName,
    email: l.email,
    website: l.website,
    businessNote: l.businessNote,
    draftSubject: l.draftSubject,
    draftBody: l.draftBody,
    status: l.status,
    ownerName: l.ownerName,
    sentAt: l.sentAt?.toISOString() ?? null,
    repliedAt: l.repliedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  }));

  const sharedRows = shared.map((s) => ({
    id: s.id,
    companyName: s.companyName,
    website: s.website,
    prefecture: s.prefecture,
    status: s.status,
    ownerName: s.ownerName,
    ownerEmail: s.ownerEmail,
    sentAt: s.sentAt?.toISOString() ?? null,
    repliedAt: s.repliedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <OutreachBoard
      initialRows={rows}
      sharedRows={sharedRows}
      isAdmin={role === "ADMIN"}
      myEmail={session?.user?.email ?? ""}
    />
  );
}
